{#
  SCD-2 price history. strategy='check' on price/payment/mileage/status means
  every time one of those changes between dbt runs, a new versioned row is
  written with dbt_valid_from / dbt_valid_to. Powers a "price dropped" badge.
  Granularity = crawl cadence (intra-crawl changes are invisible).
#}
{% snapshot snp_listing_price %}
{{ config(
    target_schema='silver',
    unique_key='vin',
    strategy='check',
    check_cols=['price', 'monthly_payment', 'mileage', 'new_used']
) }}

select
    vin,
    price,
    monthly_payment,
    mileage,
    new_used,
    crawled_at
from {{ ref('fct_listing') }}

{% endsnapshot %}
