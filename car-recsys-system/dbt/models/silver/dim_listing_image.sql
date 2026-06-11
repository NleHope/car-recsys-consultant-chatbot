/*
  Dimension: listing × image. Restricted to listings present in fct_listing.

  image_url is the PUBLIC GCS URL of the image the crawler downloaded + uploaded.
  The app serves images from our own (public-read) GCS, NOT cars.com — cars.com
  CDN URLs 404 once a listing is sold. The bucket/path depends on how the row
  was loaded (see stg_listing_images): initial-load images live in
  gs://bronze-car-recsys/images/post_images/<vin>/<n>.jpg with no dt= partition;
  weekly incremental images live in
  gs://incremental_raw/dt=<crawl_date>/images/post_images/<vin>/<n>.jpg.
  source_image_url keeps the original cars.com URL for reference/debugging only.
*/
select
    fl.listing_sk,
    li.vin,
    li.image_order,
    case
        when li.source = 'incremental' and li.crawl_date is not null then
            'https://storage.googleapis.com/incremental_raw/dt='
                || to_char(li.crawl_date, 'YYYY-MM-DD')
                || '/images/post_images/' || li.vin
                || '/' || li.image_order || '.jpg'
        else
            'https://storage.googleapis.com/bronze-car-recsys/images/post_images/'
                || li.vin || '/' || li.image_order || '.jpg'
    end                                          as image_url,
    li.source_image_url
from {{ ref('stg_listing_images') }} li
join {{ ref('fct_listing') }} fl
    on md5(li.vin) = fl.listing_sk
