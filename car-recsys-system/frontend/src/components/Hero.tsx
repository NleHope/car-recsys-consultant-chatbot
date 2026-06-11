import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import carHomePageImage from "@/images/car_home_page.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background image with parallax effect */}
      <div className="absolute inset-0">
        <img
          src={carHomePageImage}
          alt="Luxury sports car on scenic road"
          className="w-full h-full object-cover scale-105 brightness-125 contrast-105"
        />
        {/* Deep blue overlay for a cooler tone */}
        <div className="absolute inset-0 bg-[#A87601]/18" />
        {/* Minimal darkening layer for text readability */}
        <div className="absolute inset-0 bg-black/2" />
        {/* Very subtle vertical vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/8 via-transparent to-transparent" />
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />
      </div>

      {/* Subtle decorative elements */}
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-accent/3 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative z-10 container mx-auto flex min-h-screen flex-col justify-between px-4 pb-16 pt-14">
        <div className="mx-auto max-w-3xl text-center pt-3 md:pt-6 lg:pt-10">
          {/* Main heading */}
          <h1
            className="font-body text-5xl md:text-6xl lg:text-7xl font-semibold text-white leading-tight mb-6 animate-fade-in tracking-tight"
            style={{ animationDelay: "0.2s" }}
          >
            Find Your <span className="text-[#A87601]">Dream Car</span>
          </h1>

          {/* Subtitle */}
          <p
            className="font-body text-lg md:text-xl text-slate-100/90 max-w-2xl mx-auto leading-relaxed animate-fade-in"
            style={{ animationDelay: "0.4s" }}
          >
            Explore our curated collection of luxury vehicles, supercars, and
            exotic automobiles from trusted sellers worldwide.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex justify-center animate-fade-in pb-1" style={{ animationDelay: "0.6s" }}>
          <div className="flex justify-center">
            <Link to="/search">
              <Button
                size="lg"
                variant="link"
                className="group h-auto px-0 py-0 text-lg md:text-xl font-body font-medium tracking-wide text-[#A87601] no-underline hover:no-underline transition-all duration-500"
              >
                Browse Inventory
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 animate-fade-in" style={{ animationDelay: "1s" }}>
        <div className="w-px h-10 bg-gradient-to-b from-accent/60 to-transparent" />
      </div>
    </section>
  );
};

export default Hero;