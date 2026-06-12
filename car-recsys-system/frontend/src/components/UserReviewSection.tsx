/**
 * User-written reviews for a vehicle (distinct from cars.com model reviews).
 * Logged-in users can write/edit/delete one review per vehicle. Also renders the
 * "no reviews yet" empty state when both user reviews and cars.com reviews are
 * empty — fixing the old behaviour where the whole section just disappeared.
 */
import { useState, useEffect } from "react";
import { Star, User, Loader2, Pencil, Trash2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  useUserReviews, useMyReview, useSubmitReview, useDeleteReview,
} from "@/hooks/useApi";
import { isAuthenticated } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  vehicleId: string;
  /** count of cars.com (model) reviews, to decide the combined empty state */
  carsReviewCount: number;
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5"
          aria-label={`${s} star${s > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              s <= (hover || value) ? "text-[#A87601] fill-[#A87601]" : "text-muted-foreground"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn("h-4 w-4", s <= rating ? "text-[#A87601] fill-[#A87601]" : "text-muted-foreground")}
        />
      ))}
    </div>
  );
}

const UserReviewSection = ({ vehicleId, carsReviewCount }: Props) => {
  const { toast } = useToast();
  const loggedIn = isAuthenticated();

  const { data: userReviews, isLoading: loadingList } = useUserReviews(vehicleId);
  const { data: myReview } = useMyReview(vehicleId, loggedIn);
  const submit = useSubmitReview(vehicleId);
  const del = useDeleteReview(vehicleId);

  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  // Prefill the form when the user already has a review (edit mode).
  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setTitle(myReview.title ?? "");
      setText(myReview.review_text ?? "");
    }
  }, [myReview]);

  const handleSubmit = async () => {
    if (rating < 1) {
      toast({ title: "Please pick a rating", variant: "destructive" });
      return;
    }
    try {
      await submit.mutateAsync({ rating, title: title || undefined, review_text: text || undefined });
      toast({ title: myReview ? "Review updated" : "Review posted" });
      setEditing(false);
    } catch {
      toast({ title: "Could not save your review", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await del.mutateAsync();
      toast({ title: "Review deleted" });
      setRating(0); setTitle(""); setText(""); setEditing(false);
    } catch {
      toast({ title: "Could not delete your review", variant: "destructive" });
    }
  };

  const list = userReviews ?? [];
  const showForm = loggedIn && (editing || !myReview);

  return (
    <div className="mt-16">
      <h2 className="font-heading text-2xl md:text-3xl font-semibold text-foreground mb-8 flex items-center gap-3">
        <Quote className="h-6 w-6 text-accent" />
        Customer Reviews ({list.length + carsReviewCount})
      </h2>

      {/* Write / edit form (logged in only) */}
      {loggedIn ? (
        showForm ? (
          <div className="bg-card border border-border rounded-xl p-6 mb-8">
            <p className="font-semibold mb-3">{myReview ? "Edit your review" : "Write a review"}</p>
            <StarPicker value={rating} onChange={setRating} />
            <Input
              className="mt-4"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
            <textarea
              className="mt-3 w-full rounded-md border border-input bg-background p-3 text-sm min-h-24"
              placeholder="Share your experience with this car (optional)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={4000}
            />
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSubmit} disabled={submit.isPending} className="gap-2">
                {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {myReview ? "Update" : "Post review"}
              </Button>
              {myReview && (
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              )}
            </div>
          </div>
        ) : (
          // user already has a review and is not editing → show edit/delete controls
          <div className="flex justify-end gap-2 mb-6">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit your review
            </Button>
            <Button variant="ghost" size="sm" className="gap-2 text-destructive" onClick={handleDelete} disabled={del.isPending}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        )
      ) : (
        <div className="bg-muted/40 border border-border rounded-xl p-4 mb-8 text-sm text-muted-foreground">
          <Link to="/login" className="text-accent underline">Sign in</Link> to write a review.
        </div>
      )}

      {/* Empty state: no user reviews AND no cars.com reviews */}
      {!loadingList && list.length === 0 && carsReviewCount === 0 && (
        <p className="text-muted-foreground">No reviews yet — be the first to review this car.</p>
      )}

      {/* User reviews */}
      {list.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {list.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">By {r.user_name || "User"}</p>
                    {(r.updated_at || r.created_at) && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.updated_at || r.created_at!).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <Stars rating={r.rating} />
              {r.title && <p className="font-medium mt-3">{r.title}</p>}
              {r.review_text && (
                <p className="text-foreground text-sm leading-relaxed mt-2">{r.review_text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserReviewSection;
