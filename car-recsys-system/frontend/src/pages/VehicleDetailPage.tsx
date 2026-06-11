import { useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  Star,
  Shield,
  Car,
  Loader2,
  AlertCircle,
  ImageOff,
  GitCompare,
  MapPin,
  Clock,
  User,
  Quote,
  ExternalLink,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VehicleCard from "@/components/VehicleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useVehicleDetail, useSimilarVehicles, useAddFavorite, useRemoveFavorite, useFavorites, useVehicleReviews, useVehicleSeller } from "@/hooks/useApi";
import { formatPrice, isAuthenticated, trackVehicleView } from "@/lib/api";

const VehicleDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState<{ [key: number]: boolean }>({});
  
  const { data: vehicle, isLoading, error } = useVehicleDetail(id);
  const { data: similarData, isLoading: loadingSimilar } = useSimilarVehicles(id, 6);
  const { data: reviews, isLoading: loadingReviews } = useVehicleReviews(id, 10);
  const { data: seller, isLoading: loadingSeller } = useVehicleSeller(id);
  const { data: favorites } = useFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  
  const isFavorite = favorites?.some(f => f.vehicle_id === id) ?? false;

  // Placeholder image
  const placeholderImage = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop&q=80';
  
  // Handle image error
  const handleImageError = (index: number) => {
    setImageError(prev => ({ ...prev, [index]: true }));
  };

  // Get image source with fallback
  const getImageSrc = (url: string, index: number) => {
    if (imageError[index]) {
      return placeholderImage;
    }
    return url;
  };

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

  // Get placeholder images
  const getPlaceholderImages = () => {
    const images = [
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop&q=80',
    ];
    return images;
  };

  const images = vehicle.images?.length > 0 ? vehicle.images : 
    (vehicle.image_url ? [vehicle.image_url] : getPlaceholderImages());

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

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

          <div className="grid lg:grid-cols-2 gap-10">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-secondary">
                {imageError[currentImageIndex] ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-secondary">
                    <ImageOff className="h-16 w-16 mb-3 opacity-50" />
                    <p className="text-sm">Image not available</p>
                  </div>
                ) : (
                  <img
                    src={images[currentImageIndex]}
                    alt={vehicle.title || 'Vehicle'}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(currentImageIndex)}
                  />
                )}
                {images.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background rounded-full"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background rounded-full"
                      onClick={nextImage}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </>
                )}

                {/* Image counter */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-full text-xs font-medium">
                  {currentImageIndex + 1} / {images.length}
                </div>

                {/* Condition badge */}
                {vehicle.condition && (
                  <Badge className="absolute top-3 left-3 capitalize">
                    {vehicle.condition}
                  </Badge>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.slice(0, 6).map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        index === currentImageIndex 
                          ? "border-accent ring-2 ring-accent/20" 
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      {imageError[index] ? (
                        <div className="w-full h-full flex items-center justify-center bg-secondary">
                          <ImageOff className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <img 
                          src={img} 
                          alt="" 
                          className="w-full h-full object-cover"
                          onError={() => handleImageError(index)}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-medium text-accent uppercase tracking-wider mb-1">
                      {vehicle.brand || 'Vehicle'}
                    </p>
                    <h1 className="font-heading text-3xl md:text-4xl font-semibold text-foreground">
                      {vehicle.car_model || vehicle.title}
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
                <p className="text-muted-foreground">{vehicle.title}</p>
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

              {/* Vehicle History */}
              {(vehicle.accidents_damage || vehicle.one_owner !== null) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-accent" />
                      Vehicle History
                    </h3>
                    <div className="space-y-2">
                      {vehicle.accidents_damage && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Accidents:</span>
                          <span className={vehicle.accidents_damage.toLowerCase().includes('none') ? 'text-green-500' : 'text-yellow-500'}>
                            {vehicle.accidents_damage}
                          </span>
                        </div>
                      )}
                      {vehicle.one_owner !== null && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Ownership:</span>
                          <span className={vehicle.one_owner ? 'text-green-500' : ''}>
                            {vehicle.one_owner ? 'Single Owner' : 'Multiple Owners'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

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
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      {/* Dealer Image Placeholder */}
                      <div className="h-32 bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
                        <Car className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                      
                      <div className="p-4 space-y-3">
                        {/* Dealer Name & Rating */}
                        <div>
                          <p className="font-semibold text-foreground text-lg">{seller.seller_name}</p>
                          {seller.seller_rating && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star 
                                    key={star} 
                                    className={`h-4 w-4 ${
                                      star <= Math.round(seller.seller_rating!) 
                                        ? 'text-[#A87601] fill-[#A87601]' 
                                        : 'text-muted-foreground'
                                    }`} 
                                  />
                                ))}
                              </div>
                              <span className="font-medium text-sm">{seller.seller_rating.toFixed(1)}</span>
                              {seller.seller_rating_count && (
                                <span className="text-muted-foreground text-sm">
                                  · {seller.seller_rating_count.toLocaleString()} reviews
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Business Hours Status */}
                        {seller.hours_monday && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-red-500 border-red-500">Closed</Badge>
                            <span className="text-sm text-muted-foreground">Opens 8:30am</span>
                          </div>
                        )}
                        
                        {/* Address */}
                        {(seller.seller_address || seller.seller_city) && (
                          <div className="flex items-start gap-2 text-sm pt-2 border-t border-border">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">
                              {seller.seller_address && `${seller.seller_address}, `}
                              {seller.seller_city && `${seller.seller_city}, `}
                              {seller.seller_state} {seller.seller_zip}
                            </span>
                          </div>
                        )}
                        
                        {/* Website */}
                        {seller.seller_website && (
                          <a 
                            href={seller.seller_website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-accent hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Visit dealership website
                          </a>
                        )}
                        
                        {/* Phone */}
                        {seller.seller_phone && (
                          <a 
                            href={`tel:${seller.seller_phone}`}
                            className="flex items-center gap-2 text-sm text-foreground hover:text-accent"
                          >
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {seller.seller_phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Customer Reviews Section */}
          {reviews && reviews.length > 0 && (
            <div className="mt-16">
              <h2 className="font-heading text-2xl md:text-3xl font-semibold text-foreground mb-8 flex items-center gap-3">
                <Quote className="h-6 w-6 text-accent" />
                Customer Reviews ({reviews.length})
              </h2>
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