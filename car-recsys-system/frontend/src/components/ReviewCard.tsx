/** A single review card for the /reviews grid (carvago-style). */
import { Star, ImageOff } from "lucide-react";
import { useState } from "react";
import type { ReviewCard as ReviewCardData } from "@/lib/api";
import { cn } from "@/lib/utils";

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        className={cn("h-4 w-4", s <= rating ? "text-[#A87601] fill-[#A87601]" : "text-muted-foreground")}
      />
    ))}
  </div>
);

const ReviewCard = ({ review }: { review: ReviewCardData }) => {
  const [imgError, setImgError] = useState(false);
  const rating = review.overall_rating ?? 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Model image */}
      <div className="aspect-[16/10] bg-secondary">
        {review.model_image_url && !imgError ? (
          <img
            src={review.model_image_url}
            alt={review.car_name || "Vehicle"}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8 opacity-50" />
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="inline-block text-[10px] font-bold tracking-wide rounded bg-accent/15 text-accent px-2 py-0.5 mb-1">
              VERIFIED REVIEW
            </span>
            <p className="font-semibold text-foreground">{review.user_name || "Anonymous"}</p>
            {review.reviewer_from && (
              <p className="text-xs text-muted-foreground">{review.reviewer_from}</p>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground shrink-0">
            <p className="underline">Source</p>
            <p>cars.com</p>
          </div>
        </div>

        <Stars rating={rating} />

        {review.review_title && (
          <p className="font-medium text-foreground mt-3">{review.review_title}</p>
        )}
        {review.review_text && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-6">{review.review_text}</p>
        )}
        {review.car_name && (
          <p className="text-xs text-muted-foreground mt-auto pt-3">{review.car_name}</p>
        )}
      </div>
    </div>
  );
};

export default ReviewCard;
