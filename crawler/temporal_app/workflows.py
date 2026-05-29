"""Temporal workflows for the car-recsys data platform.

  WeeklyCrawlWorkflow  crawl → scrape → upload for one page (weekly)
  TransformWorkflow    load_bronze → dbt_build → refresh_matviews
  MLWorkflow           compute_item_similarity ∥ embed_vehicles (parallel)

Replaces the three Airflow DAGs. Schedules are configured on the self-hosted
Temporal server (see scripts/create_schedule.py). Chain crawl → transform → ml
by enabling that in the schedule script, or trigger each independently.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from temporal_app.activities import (
        CrawlInput,
        CrawlLinksResult,
        EmbedResult,
        LoadBronzeResult,
        ScrapeResult,
        SimilarityResult,
        UploadResult,
        compute_item_similarity_activity,
        crawl_links_activity,
        dbt_build_activity,
        embed_vehicles_activity,
        ensure_partition_activity,
        load_bronze_activity,
        refresh_matviews_activity,
        scrape_details_activity,
        upload_gcs_activity,
    )


@dataclass
class WeeklyCrawlInput:
    page: int = 1


@dataclass
class WeeklyCrawlResult:
    page: int
    link_count: int
    detail_done: int
    detail_fail: int
    detail_skip: int
    json_uploaded: int
    images_uploaded: int


# Default retry — Temporal already retries automatically; tune timeouts only.
_LINK_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=30),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=10),
    maximum_attempts=3,
)
_SCRAPE_RETRY = RetryPolicy(
    initial_interval=timedelta(minutes=1),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=15),
    maximum_attempts=2,  # scrape is expensive; don't retry many times
)
_UPLOAD_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=10),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=5),
    maximum_attempts=5,  # GCS is cheap to retry
)


@workflow.defn(name="WeeklyCrawl")
class WeeklyCrawlWorkflow:
    @workflow.run
    async def run(self, inp: WeeklyCrawlInput) -> WeeklyCrawlResult:
        page = inp.page
        workflow.logger.info("WeeklyCrawl starting page=%s", page)
        crawl_date = workflow.now().strftime("%Y-%m-%d")
        act_in = CrawlInput(page=page, crawl_date=crawl_date)

        link_res: CrawlLinksResult = await workflow.execute_activity(
            crawl_links_activity,
            act_in,
            start_to_close_timeout=timedelta(minutes=15),
            heartbeat_timeout=timedelta(minutes=5),
            retry_policy=_LINK_RETRY,
        )

        scrape_res: ScrapeResult = await workflow.execute_activity(
            scrape_details_activity,
            act_in,
            start_to_close_timeout=timedelta(hours=2),
            heartbeat_timeout=timedelta(minutes=10),
            retry_policy=_SCRAPE_RETRY,
        )

        upload_res: UploadResult = await workflow.execute_activity(
            upload_gcs_activity,
            act_in,
            start_to_close_timeout=timedelta(minutes=30),
            heartbeat_timeout=timedelta(minutes=5),
            retry_policy=_UPLOAD_RETRY,
        )

        return WeeklyCrawlResult(
            page=page,
            link_count=link_res.link_count,
            detail_done=scrape_res.done,
            detail_fail=scrape_res.fail,
            detail_skip=scrape_res.skip,
            json_uploaded=upload_res.json_uploaded,
            images_uploaded=upload_res.images_uploaded,
        )


# ─────────────────────────────── Transform ──────────────────────────────────

@dataclass
class TransformResult:
    bronze_inserted: int
    bronze_scanned: int


_DB_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=15),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=5),
    maximum_attempts=3,
)


@workflow.defn(name="Transform")
class TransformWorkflow:
    """Bronze JSON → Postgres → dbt silver/gold → materialized views."""

    @workflow.run
    async def run(self, crawl_date: str = "") -> TransformResult:
        dt = crawl_date or workflow.now().strftime("%Y-%m-%d")
        workflow.logger.info("Transform starting dt=%s", dt)

        bronze: LoadBronzeResult = await workflow.execute_activity(
            load_bronze_activity,
            dt,
            start_to_close_timeout=timedelta(minutes=30),
            retry_policy=_DB_RETRY,
        )

        await workflow.execute_activity(
            ensure_partition_activity,
            dt,
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=_DB_RETRY,
        )

        await workflow.execute_activity(
            dbt_build_activity,
            start_to_close_timeout=timedelta(hours=1),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        await workflow.execute_activity(
            refresh_matviews_activity,
            start_to_close_timeout=timedelta(minutes=15),
            retry_policy=_DB_RETRY,
        )

        return TransformResult(
            bronze_inserted=bronze.inserted,
            bronze_scanned=bronze.scanned,
        )


# ─────────────────────────────────── ML ─────────────────────────────────────

@dataclass
class MLResult:
    similarity_items: int
    similarity_pairs: int
    embedded: int


@workflow.defn(name="ML")
class MLWorkflow:
    """Recompute item-item similarity + re-embed vehicles to Qdrant.

    The two activities are independent → run them concurrently.
    """

    @workflow.run
    async def run(self) -> MLResult:
        workflow.logger.info("ML starting")

        sim_task = workflow.execute_activity(
            compute_item_similarity_activity,
            start_to_close_timeout=timedelta(minutes=30),
            retry_policy=_DB_RETRY,
        )
        embed_task = workflow.execute_activity(
            embed_vehicles_activity,
            start_to_close_timeout=timedelta(hours=1),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        sim: SimilarityResult
        embed: EmbedResult
        sim, embed = await asyncio.gather(sim_task, embed_task)

        return MLResult(
            similarity_items=sim.items,
            similarity_pairs=sim.pairs,
            embedded=embed.embedded,
        )
