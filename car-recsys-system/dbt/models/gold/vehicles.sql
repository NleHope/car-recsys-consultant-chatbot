{{ config(
    materialized='incremental',
    unique_key='vin',
    incremental_strategy='merge',
    merge_exclude_columns=['first_seen_date'],
    on_schema_change='sync_all_columns'
) }}

/*
  Gold mart: one row per listing — the backend's primary table (replaces the
  legacy raw.used_vehicles). `vehicle_id` is kept as an alias of `vin` so the
  FastAPI repoint from raw.* to gold.* is near-mechanical. The car-MODEL rating
  is COPIED onto each listing (deliberate read optimization — never aggregated).
*/
with img_agg as (
    select
        listing_sk,
        count(*)                                              as image_count,
        max(image_url) filter (where image_order = 1)         as primary_image_url
    from {{ ref('dim_listing_image') }}
    group by listing_sk
),

feat_agg as (
    select listing_sk, count(*) as feature_count
    from {{ ref('bridge_listing_feature') }}
    group by listing_sk
),

-- body_type derived from the model name via a seed (cars.com has no body-type
-- field). Strip the trailing -YYYY year from the slug to match the seed key;
-- unmapped models get NULL (just absent from body-type category filters).
body_type_map as (
    select brand_model_base, body_type
    from {{ ref('car_model_body_type') }}
),

-- raw exterior color name -> one of ~12 basic groups (for the color-swatch filter).
color_map as (
    select raw_color, color_group from {{ ref('color_map') }}
)

select
    fl.vin                          as vehicle_id,      -- backend-compat alias
    fl.vin,
    fl.listing_sk,
    fl.stock_number,
    fl.new_used,
    fl.title,
    cm.brand,
    cm.car_name,
    fl.car_model_slug               as car_model,
    fl.price,
    fl.monthly_payment,
    fl.mileage,
    fl.exterior_color,
    nullif((regexp_match(fl.car_model_slug, '-((19|20)[0-9][0-9])$'))[1], '')::int as year,
    coalesce(
        cm_color.color_group,
        case
            when lower(fl.exterior_color) like '%black%'
              or lower(fl.exterior_color) like '%ebony%'
              or lower(fl.exterior_color) like '%caviar%'
              or lower(fl.exterior_color) like '%onyx%'
              or lower(fl.exterior_color) like '%midnight%'
              or lower(fl.exterior_color) like '%nightfall%' then 'Black'
            when lower(fl.exterior_color) like '%white%'
              or lower(fl.exterior_color) like '%pearl%'
              or lower(fl.exterior_color) like '%ice%'
              or lower(fl.exterior_color) like '%blizzard%'
              or lower(fl.exterior_color) like '%snow%'
              or lower(fl.exterior_color) like '%frost%'
              or lower(fl.exterior_color) like '%ivory%' then 'White'
            when lower(fl.exterior_color) like '%silver%'
              or lower(fl.exterior_color) like '%sterling%'
              or lower(fl.exterior_color) like '%platinum%'
              or lower(fl.exterior_color) like '%aluminum%' then 'Silver'
            when lower(fl.exterior_color) like '%gray%' or lower(fl.exterior_color) like '%grey%'
              or lower(fl.exterior_color) like '%steel%'
              or lower(fl.exterior_color) like '%graphite%'
              or lower(fl.exterior_color) like '%granite%'
              or lower(fl.exterior_color) like '%gunmetal%' or lower(fl.exterior_color) like '%gun metal%' or lower(fl.exterior_color) like '%gun metallic%'
              or lower(fl.exterior_color) like '%iridium%'
              or lower(fl.exterior_color) like '%magnetic%'
              or lower(fl.exterior_color) like '%cement%'
              or lower(fl.exterior_color) like '%charcoal%'
              or lower(fl.exterior_color) like '%slate%'
              or lower(fl.exterior_color) like '%ash%'
              or lower(fl.exterior_color) like '%shadow%' then 'Gray'
            when lower(fl.exterior_color) like '%red%'
              or lower(fl.exterior_color) like '%scarlet%'
              or lower(fl.exterior_color) like '%ruby%'
              or lower(fl.exterior_color) like '%crimson%'
              or lower(fl.exterior_color) like '%cherry%'
              or lower(fl.exterior_color) like '%burgundy%' then 'Red'
            when lower(fl.exterior_color) like '%blue%'
              or lower(fl.exterior_color) like '%navy%'
              or lower(fl.exterior_color) like '%indigo%'
              or lower(fl.exterior_color) like '%azure%' then 'Blue'
            when lower(fl.exterior_color) like '%green%'
              or lower(fl.exterior_color) like '%moss%'
              or lower(fl.exterior_color) like '%emerald%'
              or lower(fl.exterior_color) like '%olive%' then 'Green'
            when lower(fl.exterior_color) like '%brown%'
              or lower(fl.exterior_color) like '%bronze%'
              or lower(fl.exterior_color) like '%mocha%'
              or lower(fl.exterior_color) like '%copper%'
              or lower(fl.exterior_color) like '%mahogany%' then 'Brown'
            when lower(fl.exterior_color) like '%beige%' or lower(fl.exterior_color) like '%tan%'
              or lower(fl.exterior_color) like '%sand%'
              or lower(fl.exterior_color) like '%champagne%'
              or lower(fl.exterior_color) like '%cream%' then 'Beige'
            when lower(fl.exterior_color) like '%gold%' or lower(fl.exterior_color) like '%yellow%' then 'Yellow'
            when lower(fl.exterior_color) like '%orange%' then 'Orange'
            else 'Other'
        end
    ) as color_group,
    fl.interior_color,
    fl.fuel_type,
    bt.body_type,
    fl.engine,
    fl.mpg,
    fl.drivetrain,
    fl.transmission,
    fl.clean_title,
    fl.has_accidents,
    fl.is_one_owner,
    fl.is_personal_use,
    fl.has_open_recall,
    fl.warranty,
    -- seller (denormalized)
    ds.seller_key,
    ds.seller_name,
    ds.seller_link,
    ds.destination,
    ds.seller_rating,
    ds.seller_rating_count,
    -- car-model rating (copied, not aggregated)
    mr.car_rating,
    mr.car_rating_count,
    mr.percentage_recommend,
    mr.rating_comfort,
    mr.rating_interior,
    mr.rating_performance,
    mr.rating_value,
    mr.rating_exterior,
    mr.rating_reliability,
    cm.car_link,
    cm.review_link,
    -- aggregates
    coalesce(img.image_count, 0)    as image_count,
    img.primary_image_url,
    coalesce(feat.feature_count, 0) as feature_count,
    fl.source,
    fl.last_updated_date,
    coalesce(fl.crawl_date, current_date) as first_seen_date,
    fl.crawled_at,
    fl.dbt_loaded_at,
    -- legacy-compatible aliases — let the FastAPI backend repoint from
    -- raw.used_vehicles to gold.vehicles as a pure schema-name swap.
    fl.new_used                     as condition,
    cm.car_link                     as vehicle_url,
    mr.rating_comfort               as comfort_rating,
    mr.rating_interior              as interior_rating,
    mr.rating_performance           as performance_rating,
    mr.rating_value                 as value_rating,
    mr.rating_exterior              as exterior_rating,
    mr.rating_reliability           as reliability_rating
from {{ ref('fct_listing') }} fl
left join {{ ref('dim_car_model') }}   cm  on fl.car_model_sk = cm.car_model_sk
left join {{ ref('fct_model_rating') }} mr on fl.car_model_sk = mr.car_model_sk
left join {{ ref('dim_seller') }}      ds  on fl.seller_sk    = ds.seller_sk
left join img_agg  img  on fl.listing_sk = img.listing_sk
left join feat_agg feat on fl.listing_sk = feat.listing_sk
left join body_type_map bt
    on regexp_replace(fl.car_model_slug, '-(19|20)[0-9][0-9]$', '') = bt.brand_model_base
left join color_map cm_color
    on lower(cm_color.raw_color) = lower(fl.exterior_color)
{% if is_incremental() %}
where fl.last_updated_date >= (select coalesce(max(last_updated_date), '1900-01-01') from {{ this }})
{% endif %}
