"""Create / update schedules on the self-hosted Temporal server.

  car-crawler-weekly   WeeklyCrawl(page=1)   every Mon 02:00 (cron)
  car-transform-weekly Transform             every Mon 06:00
  car-ml-weekly        ML                    every Mon 08:00

The three are time-staggered (crawl → transform → ml) rather than chained, so
each can be re-run independently. Idempotent: updates if the schedule exists.
"""
from __future__ import annotations

import asyncio

from temporalio.client import (
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleAlreadyRunningError,
    ScheduleSpec,
)

from temporal_app.client import connect
from temporal_app.shared import (
    CRAWL_TASK_QUEUE,
    PIPELINE_TASK_QUEUE,
    WORKFLOW_ID_PREFIX,
)
from temporal_app.workflows import (
    MLWorkflow,
    TransformWorkflow,
    WeeklyCrawlInput,
    WeeklyCrawlWorkflow,
)

# (schedule_id, run_fn, arg, workflow_id, cron, task_queue)
_SCHEDULES = [
    ("car-crawler-weekly", WeeklyCrawlWorkflow.run, WeeklyCrawlInput(page=1),
     f"{WORKFLOW_ID_PREFIX}-crawl", "0 2 * * 1", CRAWL_TASK_QUEUE),
    ("car-transform-weekly", TransformWorkflow.run, None,
     f"{WORKFLOW_ID_PREFIX}-transform", "0 6 * * 1", PIPELINE_TASK_QUEUE),
    ("car-ml-weekly", MLWorkflow.run, None,
     f"{WORKFLOW_ID_PREFIX}-ml", "0 8 * * 1", PIPELINE_TASK_QUEUE),
]


async def main() -> None:
    client = await connect()

    for sched_id, run_fn, arg, wf_id, cron, task_queue in _SCHEDULES:
        action_kwargs = dict(id=wf_id, task_queue=task_queue)
        if arg is not None:
            action = ScheduleActionStartWorkflow(run_fn, arg, **action_kwargs)
        else:
            action = ScheduleActionStartWorkflow(run_fn, args=[], **action_kwargs)

        schedule = Schedule(
            action=action,
            spec=ScheduleSpec(cron_expressions=[cron]),
        )

        try:
            handle = await client.create_schedule(sched_id, schedule)
            print(f"Created schedule {sched_id} ({cron})")
        except ScheduleAlreadyRunningError:
            handle = client.get_schedule_handle(sched_id)
            await handle.update(lambda _: schedule)
            print(f"Updated schedule {sched_id} ({cron})")


if __name__ == "__main__":
    asyncio.run(main())
