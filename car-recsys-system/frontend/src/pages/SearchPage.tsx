import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, Loader2, X } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VehicleCard from "@/components/VehicleCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useVehicleSearch, useColorGroups, useFeatureOptions } from "@/hooks/useApi";
import { SearchParams } from "@/lib/api";

// Available filter options (can be fetched from API later)
const brands = ["Audi", "BMW", "Buick", "Chevrolet", "Dodge", "Ford", "GMC", "Honda", "Hyundai", "Jeep", "Kia", "Lexus", "Lincoln", "Mazda", "Mercedes-Benz", "Mitsubishi", "Nissan", "RAM", "Subaru", "Toyota", "Volkswagen", "Volvo"];
const fuelTypes = ["Gasoline", "Diesel", "Electric", "Hybrid"];
const transmissions = ["Automatic", "Manual", "CVT"];
const bodyTypes = ["SUV", "Sedan", "Pickup Truck", "Coupe", "Hatchback", "Wagon", "Convertible", "Minivan"];
const drivetrains = [
  { value: "All-wheel Drive", label: "AWD" },
  { value: "Four-wheel Drive", label: "4WD" },
  { value: "Front-wheel Drive", label: "FWD" },
  { value: "Rear-wheel Drive", label: "RWD" },
];
// Registration-year dropdown options (newest first), matching gold.vehicles.year range.
const years = Array.from({ length: 2027 - 2000 + 1 }, (_, i) => 2027 - i);

// color_group -> swatch hex (the 12 basic groups from the dbt color_map).
const COLOR_SWATCHES: { group: string; hex: string }[] = [
  { group: "Black", hex: "#111111" },
  { group: "White", hex: "#f5f5f5" },
  { group: "Gray", hex: "#808080" },
  { group: "Silver", hex: "#c0c0c0" },
  { group: "Red", hex: "#c62828" },
  { group: "Blue", hex: "#1565c0" },
  { group: "Green", hex: "#2e7d32" },
  { group: "Brown", hex: "#5d4037" },
  { group: "Beige", hex: "#d9c9a3" },
  { group: "Yellow", hex: "#f9c80e" },
  { group: "Orange", hex: "#ef6c00" },
  { group: "Other", hex: "#9e9e9e" },
];

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedBrand, setSelectedBrand] = useState(searchParams.get("brand") || "");
  const [selectedFuel, setSelectedFuel] = useState(searchParams.get("fuel") || "");
  const [selectedTransmission, setSelectedTransmission] = useState(searchParams.get("transmission") || "");
  const [priceMin, setPriceMin] = useState(searchParams.get("price_min") || "");
  const [priceMax, setPriceMax] = useState(searchParams.get("price_max") || "");
  const [mileageMax, setMileageMax] = useState(searchParams.get("mileage_max") || "");
  const [yearMin, setYearMin] = useState(searchParams.get("year_min") || "");
  const [yearMax, setYearMax] = useState(searchParams.get("year_max") || "");
  const [selectedDrivetrain, setSelectedDrivetrain] = useState(searchParams.get("drivetrain") || "");
  const [selectedBody, setSelectedBody] = useState(searchParams.get("body") || "");
  const [selectedColor, setSelectedColor] = useState(searchParams.get("color") || "");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(
    (searchParams.get("features") || "").split(",").map((f) => f.trim()).filter(Boolean)
  );
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "created_at");
  const [sortOrder, setSortOrder] = useState(searchParams.get("order") || "desc");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Lookup data for the swatch + feature-checkbox filters.
  const { data: colorGroups } = useColorGroups();
  const { data: featureOptions } = useFeatureOptions(15);

  const toggleFeature = (name: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]
    );
    setPage(1);
  };

  // Only render swatches for color groups that actually have listings.
  const availableColorGroups = new Set((colorGroups ?? []).map((c) => c.color_group));

  // "Popular Categories" on the home page link to /search?category=<Name>.
  // Resolve that into the right backend filter: fuel categories map to
  // fuel_type, the rest map to body_type (derived in gold.vehicles).
  const FUEL_CATEGORIES = ["Electric", "Hybrid", "Diesel"];
  const category = searchParams.get("category") || "";
  const categoryFuel = FUEL_CATEGORIES.includes(category) ? category : undefined;
  const categoryBody = category && !categoryFuel ? category : undefined;

  // Build API params
  const apiParams: SearchParams = {
    query: searchQuery || undefined,
    brand: selectedBrand && selectedBrand !== "all" ? selectedBrand : undefined,
    fuel_type: (selectedFuel && selectedFuel !== "all" ? selectedFuel : undefined) ?? categoryFuel,
    transmission: selectedTransmission && selectedTransmission !== "all" ? selectedTransmission : undefined,
    drivetrain: selectedDrivetrain && selectedDrivetrain !== "all" ? selectedDrivetrain : undefined,
    body_type: (selectedBody && selectedBody !== "all" ? selectedBody : undefined) ?? categoryBody,
    color: selectedColor && selectedColor !== "all" ? selectedColor : undefined,
    features: selectedFeatures.length ? selectedFeatures.join(",") : undefined,
    year_min: yearMin ? parseInt(yearMin) : undefined,
    year_max: yearMax ? parseInt(yearMax) : undefined,
    price_min: priceMin ? parseFloat(priceMin.replace(/\D/g, "")) : undefined,
    price_max: priceMax ? parseFloat(priceMax.replace(/\D/g, "")) : undefined,
    mileage_max: mileageMax && mileageMax !== "all" ? parseFloat(mileageMax) : undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    page,
    page_size: 24,
  };

  const { data, isLoading, error } = useVehicleSearch(apiParams);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    // Preserve the category from the home-page link so the body_type/fuel filter sticks.
    if (category) params.set("category", category);
    if (searchQuery) params.set("q", searchQuery);
    if (selectedBrand && selectedBrand !== "all") params.set("brand", selectedBrand);
    if (selectedFuel && selectedFuel !== "all") params.set("fuel", selectedFuel);
    if (selectedTransmission && selectedTransmission !== "all") params.set("transmission", selectedTransmission);
    if (selectedDrivetrain && selectedDrivetrain !== "all") params.set("drivetrain", selectedDrivetrain);
    if (selectedBody && selectedBody !== "all") params.set("body", selectedBody);
    if (selectedColor && selectedColor !== "all") params.set("color", selectedColor);
    if (selectedFeatures.length) params.set("features", selectedFeatures.join(","));
    if (yearMin) params.set("year_min", yearMin);
    if (yearMax) params.set("year_max", yearMax);
    if (priceMin) params.set("price_min", priceMin);
    if (priceMax) params.set("price_max", priceMax);
    if (mileageMax && mileageMax !== "all") params.set("mileage_max", mileageMax);
    if (sortBy !== "created_at") params.set("sort", sortBy);
    if (sortOrder !== "desc") params.set("order", sortOrder);
    if (page > 1) params.set("page", page.toString());

    setSearchParams(params, { replace: true });
  }, [category, searchQuery, selectedBrand, selectedFuel, selectedTransmission, selectedDrivetrain, selectedBody, selectedColor, selectedFeatures, yearMin, yearMax, priceMin, priceMax, mileageMax, sortBy, sortOrder, page]);

  const clearCategory = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("category");
    setSearchParams(params, { replace: true });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedBrand("");
    setSelectedFuel("");
    setSelectedTransmission("");
    setSelectedDrivetrain("");
    setSelectedBody("");
    setSelectedColor("");
    setSelectedFeatures([]);
    setYearMin("");
    setYearMax("");
    setPriceMin("");
    setPriceMax("");
    setMileageMax("");
    setSortBy("created_at");
    setSortOrder("desc");
    setPage(1);
    clearCategory();
  };

  const hasActiveFilters = searchQuery || selectedBrand || selectedFuel || selectedTransmission || selectedDrivetrain || selectedBody || selectedColor || selectedFeatures.length > 0 || yearMin || yearMax || priceMin || priceMax || mileageMax || category;

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Brand */}
      <div>
        <Label className="text-sm font-medium mb-2 block text-black">
          Make / Brand
        </Label>
        <Select value={selectedBrand} onValueChange={(val) => { setSelectedBrand(val); setPage(1); }}>
          <SelectTrigger className="h-10 bg-white text-black border-white/20">
            <SelectValue placeholder="All makes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All makes</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand} value={brand}>{brand}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Registration Year */}
      <div>
        <Label className="text-sm font-medium mb-2 block text-black">
          Registration Year
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Select value={yearMin || "all"} onValueChange={(val) => { setYearMin(val === "all" ? "" : val); setPage(1); }}>
            <SelectTrigger className="h-10 bg-white text-black border-white/20">
              <SelectValue placeholder="From" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">From</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearMax || "all"} onValueChange={(val) => { setYearMax(val === "all" ? "" : val); setPage(1); }}>
            <SelectTrigger className="h-10 bg-white text-black border-white/20">
              <SelectValue placeholder="To" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">To</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Price Range */}
      <div>
        <Label className="text-sm font-medium mb-2 block text-black">
          Price Range
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="text"
            placeholder="Min $"
            value={priceMin}
            onChange={(e) => { setPriceMin(e.target.value); setPage(1); }}
            className="h-10 bg-white text-black border-white/20"
          />
          <Input
            type="text"
            placeholder="Max $"
            value={priceMax}
            onChange={(e) => { setPriceMax(e.target.value); setPage(1); }}
            className="h-10 bg-white text-black border-white/20"
          />
        </div>
      </div>

      {/* Mileage */}
      <div>
        <Label className="text-sm font-medium mb-2 block text-black">
          Maximum Mileage
        </Label>
        <Select value={mileageMax} onValueChange={(val) => { setMileageMax(val); setPage(1); }}>
          <SelectTrigger className="h-10 bg-white text-black border-white/20">
            <SelectValue placeholder="Any mileage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any mileage</SelectItem>
            <SelectItem value="10000">Under 10,000 mi</SelectItem>
            <SelectItem value="25000">Under 25,000 mi</SelectItem>
            <SelectItem value="50000">Under 50,000 mi</SelectItem>
            <SelectItem value="75000">Under 75,000 mi</SelectItem>
            <SelectItem value="100000">Under 100,000 mi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Fuel Type */}
      <div>
        <Label className="text-sm font-medium mb-2 block text-black">
          Fuel Type
        </Label>
        <Select value={selectedFuel} onValueChange={(val) => { setSelectedFuel(val); setPage(1); }}>
          <SelectTrigger className="h-10 bg-white text-black border-white/20">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {fuelTypes.map((fuel) => (
              <SelectItem key={fuel} value={fuel}>{fuel}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transmission */}
      <div>
        <Label className="text-sm font-medium mb-2 block text-black">
          Transmission
        </Label>
        <Select value={selectedTransmission} onValueChange={(val) => { setSelectedTransmission(val); setPage(1); }}>
          <SelectTrigger className="h-10 bg-white text-black border-white/20">
            <SelectValue placeholder="All transmissions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All transmissions</SelectItem>
            {transmissions.map((trans) => (
              <SelectItem key={trans} value={trans}>{trans}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drivetrain */}
      <div>
        <Label className="text-sm font-medium mb-2 block text-black">
          Drivetrain
        </Label>
        <Select value={selectedDrivetrain} onValueChange={(val) => { setSelectedDrivetrain(val); setPage(1); }}>
          <SelectTrigger className="h-10 bg-white text-black border-white/20">
            <SelectValue placeholder="All drivetrains" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All drivetrains</SelectItem>
            {drivetrains.map((dt) => (
              <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Body Type */}
      <div>
        <Label className="text-sm font-medium mb-2 block text-black">
          Body Type
        </Label>
        <Select value={selectedBody} onValueChange={(val) => { setSelectedBody(val); setPage(1); }}>
          <SelectTrigger className="h-10 bg-white text-black border-white/20">
            <SelectValue placeholder="All body types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All body types</SelectItem>
            {bodyTypes.map((bt) => (
              <SelectItem key={bt} value={bt}>{bt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Exterior Color */}
      <div>
        <Label className="text-sm font-medium mb-2 block text-black">
          Exterior Color
        </Label>
        <div className="grid grid-cols-6 gap-2">
          {COLOR_SWATCHES.filter((c) => availableColorGroups.size === 0 || availableColorGroups.has(c.group)).map((c) => {
            const active = selectedColor === c.group;
            return (
              <button
                key={c.group}
                type="button"
                title={c.group}
                aria-label={c.group}
                onClick={() => { setSelectedColor(active ? "" : c.group); setPage(1); }}
                className={`h-8 w-8 rounded-full border transition-all ${
                  active ? "ring-2 ring-offset-2 ring-[#A87601] border-[#A87601]" : "border-black/20 hover:border-black/50"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
        {selectedColor && (
          <p className="mt-2 text-xs text-black/70">Selected: {selectedColor}</p>
        )}
      </div>

      {/* Features */}
      {featureOptions && featureOptions.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block text-black">
            Features
          </Label>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {featureOptions.map((f) => (
              <label
                key={f.feature_name}
                className="flex items-center gap-2 text-sm text-black cursor-pointer"
              >
                <Checkbox
                  checked={selectedFeatures.includes(f.feature_name)}
                  onCheckedChange={() => toggleFeature(f.feature_name)}
                  className="bg-white border-black/30 data-[state=checked]:bg-[#A87601] data-[state=checked]:border-[#A87601]"
                />
                <span>{f.feature_name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Reset Button */}
      {hasActiveFilters && (
        <Button variant="outline" onClick={clearFilters} className="w-full">
          Reset Filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-28 pb-16">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="mb-10">
            <h1 className="font-poppins text-3xl md:text-4xl font-semibold text-foreground mb-2">
              Browse Inventory
            </h1>
            <p className="text-muted-foreground">
              Explore our collection of quality vehicles
            </p>
          </div>

          {/* Search Header */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by make, model, or keyword..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-11 h-12 rounded-xl"
              />
            </div>

            {/* Sort */}
            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(val) => {
              const [sort, order] = val.split("-");
              setSortBy(sort);
              setSortOrder(order);
              setPage(1);
            }}>
              <SelectTrigger className="w-48 h-12">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">Newest First</SelectItem>
                <SelectItem value="created_at-asc">Oldest First</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="mileage-asc">Mileage: Low to High</SelectItem>
              </SelectContent>
            </Select>

            {/* Mobile filter button */}
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden h-12">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                    <FilterContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex gap-8">
            {/* Desktop Sidebar Filters */}
            <aside className="hidden md:block w-72 shrink-0">
              <div className="sticky top-28 bg-[#E6E6E6] rounded-2xl p-6 border border-[#A87601]">
                <h3 className="font-poppins text-2xl font-semibold mb-6 text-black text-center">
                  Filters
                </h3>
                <FilterContent />
              </div>
            </aside>

            {/* Results */}
            <div className="flex-1">
              {/* Results count */}
              <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <p className="text-muted-foreground">
                  {isLoading ? (
                    "Searching..."
                  ) : (
                    <>
                      Found <span className="text-foreground font-semibold">{data?.total || 0}</span> vehicles
                    </>
                  )}
                </p>
                {category && (
                  <button
                    type="button"
                    onClick={clearCategory}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 text-accent border border-accent/30 px-3 py-1 text-sm font-medium hover:bg-accent/25 transition-colors"
                  >
                    {category}
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                  <span className="ml-3 text-muted-foreground">Loading vehicles...</span>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <div className="text-center py-20 bg-secondary/30 rounded-2xl">
                  <p className="text-muted-foreground text-lg mb-4">
                    Unable to load vehicles. Please try again.
                  </p>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Retry
                  </Button>
                </div>
              )}

              {/* Results Grid */}
              {!isLoading && !error && data?.results && data.results.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {data.results.map((vehicle, index) => (
                      <div
                        key={vehicle.vehicle_id}
                        className="animate-fade-in opacity-0"
                        style={{ animationDelay: `${index * 0.03}s`, animationFillMode: 'forwards' }}
                      >
                        <VehicleCard vehicle={vehicle} />
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {data.total_pages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-12">
                      <Button
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <span className="text-muted-foreground">
                        Page {page} of {data.total_pages}
                      </span>
                      <Button
                        variant="outline"
                        disabled={page >= data.total_pages}
                        onClick={() => setPage(p => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Empty State */}
              {!isLoading && !error && (!data?.results || data.results.length === 0) && (
                <div className="text-center py-20 bg-secondary/30 rounded-2xl">
                  <p className="text-muted-foreground text-lg mb-4">No vehicles found</p>
                  {hasActiveFilters && (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SearchPage;