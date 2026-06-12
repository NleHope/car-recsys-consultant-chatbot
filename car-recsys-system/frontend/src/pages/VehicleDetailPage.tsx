import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  Share2,
  Phone,
  MessageCircle,
  Fuel,
  Gauge,
  Settings2,
  Palette,
  ChevronRight,
  Star,
  Car,
  Loader2,
  AlertCircle,
  GitCompare,
  User,
  Quote,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VehicleCard from "@/components/VehicleCard";
import UserReviewSection from "@/components/UserReviewSection";
import FeatureGroups from "@/components/detail/FeatureGroups";
import VehicleHistory from "@/components/detail/VehicleHistory";
import ImageGallery from "@/components/detail/ImageGallery";
import SellerCard from "@/components/detail/SellerCard";
import PaymentCalculator from "@/components/detail/PaymentCalculator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useVehicleDetail, useSimilarVehicles, useAddFavorite, useRemoveFavorite, useFavorites, useVehicleReviews, useVehicleSeller } from "@/hooks/useApi";
import { formatPrice, isAuthenticated } from "@/lib/api";

const VehicleDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: vehicle, isLoading, error } = useVehicleDetail(id);
  const { data: similarData, isLoading: loadingSimilar } = useSimilarVehicles(id, 6);
  const { data: reviews } = useVehicleReviews(id, 10);
  const { data: seller } = useVehicleSeller(id);
  const { data: favorites } = useFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  
  const isFavorite = favorites?.some(f => f.vehicle_id === id) ?? false;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pt-28 pb-16">
          <div className="container mx-auto px-4 flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <span className="ml-3 text-muted-foreground">Loading vehicle details...</span>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error or not found
  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pt-28 pb-16">
          <div className="container mx-auto px-4 text-center py-20">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="font-heading text-3xl mb-4">Vehicle not found</h1>
            <p className="text-muted-foreground mb-6">
              The vehicle you're looking for doesn't exist or has been removed.
            </p>
            <Link to="/search">
              <Button className="rounded-xl">Browse Vehicles</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const images = vehicle.images?.length > 0 ? vehicle.images :
    (vehicle.image_url ? [vehicle.image_url] : [
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop&q=80',
    ]);

  const handleFavoriteClick = async () => {
    if (!isAuthenticated()) {
      window.location.href = '/login';
      return;
    }

    try {
      if (isFavorite) {
        await removeFavorite.mutateAsync(vehicle.vehicle_id);
      } else {
        await addFavorite.mutateAsync(vehicle.vehicle_id);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const specs = [
    { icon: Gauge, label: "Mileage", value: vehicle.mileage_str || 'N/A' },
    { icon: Fuel, label: "Fuel Type", value: vehicle.fuel_type || 'N/A' },
    { icon: Settings2, label: "Transmission", value: vehicle.transmission || 'N/A' },
    { icon: Palette, label: "Exterior", value: vehicle.exterior_color || 'N/A' },
    { icon: Car, label: "Drivetrain", value: vehicle.drivetrain || 'N/A' },
    { icon: Gauge, label: "MPG", value: vehicle.mpg || 'N/A' },
  ];

  const ratings = [
    { label: "Overall", value: vehicle.car_rating },
    { label: "Comfort", value: vehicle.comfort_rating },
    { label: "Interior", value: vehicle.interior_rating },
    { label: "Performance", value: vehicle.performance_rating },
    { label: "Value", value: vehicle.value_rating },
    { label: "Reliability", value: vehicle.reliability_rating },
  ].filter(r => r.value);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Back button */}
          <Link
            to="/search"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-accent mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Link>

          <div className="grid lg:grid-cols-2 gap-10 lg:items-start">
              {/* Image Gallery — sticky on desktop so it follows the longer
                  right column instead of leaving a blank left gap. */}
              <div className="lg:sticky lg:top-24 self-start">
                <ImageGallery images={images} title={vehicle.title} />
              </div>

            {/* Details */}
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-medium text-accent uppercase tracking-wider mb-1">
                      {vehicle.brand || 'Vehicle'}
                    </p>
                    <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                      {vehicle.title || vehicle.car_name || vehicle.car_model}
                    </h1>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-11 w-11"
                      onClick={handleFavoriteClick}
                      disabled={addFavorite.isPending || removeFavorite.isPending}
                    >
                      <Heart className={`h-5 w-5 ${isFavorite ? "fill-accent text-accent" : ""}`} />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="rounded-full h-11 w-11"
                      onClick={() => navigate(`/compare?v1=${vehicle.vehicle_id}`)}
                      title="Compare with another vehicle"
                    >
                      <GitCompare className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon" className="rounded-full h-11 w-11">
                      <Share2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>

              <p className="font-heading text-4xl font-bold text-foreground">
                {formatPrice(vehicle.price)}
                {vehicle.monthly_payment && (
                  <span className="text-lg font-normal text-muted-foreground ml-2">
                    ~${vehicle.monthly_payment.toFixed(0)}/mo
                  </span>
                )}
              </p>

              <Separator />

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {specs.map((spec, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <spec.icon className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{spec.label}</p>
                      <p className="text-sm font-medium text-foreground truncate">{spec.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ratings */}
              {ratings.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
                      <Star className="h-5 w-5 text-accent" />
                      Ratings
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {ratings.map((rating, index) => (
                        <div key={index} className="text-center p-3 bg-secondary/50 rounded-lg">
                          <p className="text-2xl font-bold text-foreground">{rating.value?.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">{rating.label}</p>
                        </div>
                      ))}
                    </div>
                    {vehicle.percentage_recommend && (
                      <p className="text-sm text-muted-foreground mt-3 text-center">
                        <span className="text-accent font-semibold">{vehicle.percentage_recommend}%</span> of owners recommend this vehicle
                      </p>
                    )}
                  </div>
                </>
              )}

          <VehicleHistory
            clean_title={vehicle.clean_title}
            one_owner={vehicle.one_owner}
            accidents_damage={vehicle.accidents_damage}
            has_open_recall={vehicle.has_open_recall}
            is_personal_use={vehicle.is_personal_use}
          />
          <FeatureGroups grouped={vehicle.features_grouped} flat={vehicle.features} />
          {vehicle.price != null && <PaymentCalculator price={vehicle.price} />}

              <Separator />

              {/* Contact Buttons */}
              <div className="flex gap-3">
                <Button 
                  className="flex-1 h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground"
                  onClick={() => vehicle.vehicle_url && window.open(vehicle.vehicle_url, '_blank')}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  View Listing
                </Button>
                <Button variant="outline" className="flex-1 h-12 rounded-xl">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Contact Seller
                </Button>
              </div>

              {/* Compare Button */}
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-xl border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                onClick={() => navigate(`/compare?v1=${vehicle.vehicle_id}`)}
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Compare with Another Vehicle
              </Button>

              {/* Seller Information */}
              {seller && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
                      <User className="h-5 w-5 text-accent" />
                      Dealer Information
                    </h3>
                    <SellerCard seller={seller} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* User reviews (site users) + write form + combined empty state */}
          {id && (
            <UserReviewSection vehicleId={id} carsReviewCount={reviews?.length ?? 0} />
          )}

          {/* cars.com consumer reviews (model-level) */}
          {reviews && reviews.length > 0 && (
            <div className="mt-10">
              <h3 className="font-heading text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                <Quote className="h-5 w-5 text-accent" />
                Consumer reviews from cars.com
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {reviews.map((review, index) => (
                  <div key={index} className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
                    {/* Header with user info and date */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                          <User className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">By {review.user_name || 'Anonymous'}</p>
                          {review.user_location && (
                            <p className="text-xs text-muted-foreground">{review.user_location}</p>
                          )}
                        </div>
                      </div>
                      {review.review_time && (
                        <span className="text-xs text-muted-foreground">{review.review_time}</span>
                      )}
                    </div>
                    
                    {/* Star Rating */}
                    {review.overall_rating && (
                      <div className="flex items-center gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`h-5 w-5 ${
                              star <= review.overall_rating! 
                                ? 'text-[#A87601] fill-[#A87601]' 
                                : 'text-muted-foreground'
                            }`} 
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Review Text */}
                    {review.review_text && (
                      <p className="text-foreground text-sm leading-relaxed">
                        <span className="font-medium">{review.review_text.slice(0, 60)}</span>
                        {review.review_text.length > 60 && (
                          <span className="text-muted-foreground"> {review.review_text.slice(60)}</span>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              
              {/* See all reviews link */}
              <div className="text-center mt-6">
                <Button variant="link" className="text-accent gap-2">
                  See all reviews
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Similar Vehicles Section */}
          {similarData && similarData.recommendations.length > 0 && (
            <div className="mt-20">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="font-heading text-2xl md:text-3xl font-semibold text-foreground">
                    Similar Vehicles
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    Based on your viewing history and preferences
                  </p>
                </div>
                <Badge variant="outline" className="hidden sm:flex">
                  {similarData.algorithm}
                </Badge>
              </div>

              {loadingSimilar ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {similarData.recommendations.slice(0, 6).map((item, index) => (
                    <div
                      key={item.vehicle.vehicle_id}
                      className="animate-fade-in opacity-0"
                      style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'forwards' }}
                    >
                      <VehicleCard vehicle={item.vehicle} />
                      {item.reason && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          {item.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default VehicleDetailPage;