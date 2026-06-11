/*
  Explodes post.image[] into one row per (vin, image_order).
  WITH ORDINALITY preserves the gallery order (image_order = the {n}.jpg the
  crawler saved under images/post_images/<vin>/<n>.jpg).

  Images live in different GCS buckets depending on how the row was loaded:
    - source='initial'     -> gs://bronze-car-recsys/images/post_images/<vin>/<n>.jpg
    - source='incremental' -> gs://incremental_raw/dt=<crawl_date>/images/post_images/<vin>/<n>.jpg
  We carry source + crawl_date down so dim_listing_image can build the right
  public URL. The original cars.com CDN url is kept as source_image_url for
  reference only (it 404s once the listing is sold — that's why the app no
  longer uses it).
*/
with raw as (
    select vin, source, crawl_date, payload from {{ ref('stg_raw_latest') }}
)

select
    raw.vin,
    img.ord::int            as image_order,
    raw.source,
    raw.crawl_date,
    img.url                 as source_image_url
from raw,
     lateral jsonb_array_elements_text(
         coalesce(raw.payload->'post'->'image', '[]'::jsonb)
     ) with ordinality as img(url, ord)
where jsonb_typeof(raw.payload->'post'->'image') = 'array'
  and img.url is not null
  and img.url <> ''
