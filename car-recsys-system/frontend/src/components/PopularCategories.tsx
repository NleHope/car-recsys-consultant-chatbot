import { Link } from "react-router-dom";
import { Car, Zap, Leaf, Droplet, Crown, Wind, Truck, Sparkles } from "lucide-react";

const categories = [
  { name: "Electric", icon: Zap },
  { name: "SUV", icon: Truck },
  { name: "Sedan", icon: Car },
  { name: "Pickup Truck", icon: Truck },
  { name: "Luxury", icon: Crown },
  { name: "Crossover", icon: Car },
  { name: "Hybrid", icon: Leaf },
  { name: "Diesel", icon: Droplet },
  { name: "Coupe", icon: Car },
  { name: "Hatchback", icon: Car },
  { name: "Wagon", icon: Truck },
  { name: "Convertible", icon: Wind },
];

const PopularCategories = () => {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-poppins text-3xl font-bold text-foreground tracking-tight">
            Our Categories
          </h2>
        </div>
        <div className="flex justify-center">
          <div className="grid grid-cols-4 gap-6 w-full max-w-4xl">
            {categories.map(({ name, icon: Icon }) => (
              <Link
                key={name}
                to={`/search?category=${encodeURIComponent(name)}`}
                className="flex min-h-28 w-full flex-col items-center justify-center gap-3 rounded-lg border border-border/50 bg-[#E6E6E6] px-6 py-5 text-lg text-black transition-all duration-300 text-center hover:bg-[#A87601] hover:text-white hover:border-[#A87601]"
              >
                <Icon className="w-7 h-7" />
                {name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PopularCategories;
