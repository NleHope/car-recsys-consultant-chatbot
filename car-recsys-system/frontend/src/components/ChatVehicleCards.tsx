/** Compact grid of vehicle cards shown under a bot chat message. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { formatPrice, type ChatVehicle } from "@/lib/api";

const Card = ({ v }: { v: ChatVehicle }) => {
  const [broken, setBroken] = useState(false);
  return (
    <Link
      to={`/vehicles/${v.vin}`}
      className="flex gap-3 rounded-lg border border-border bg-background p-2 hover:bg-accent/10 transition-colors"
    >
      <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-secondary">
        {v.image_url && !broken ? (
          <img src={v.image_url} alt={v.title || "Vehicle"} className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><ImageOff className="h-4 w-4 text-muted-foreground" /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{v.title || v.vin}</p>
        {v.price != null && <p className="text-sm text-accent font-semibold">{formatPrice(v.price)}</p>}
      </div>
    </Link>
  );
};

const ChatVehicleCards = ({ vehicles }: { vehicles: ChatVehicle[] }) => {
  if (!vehicles || vehicles.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      {vehicles.map((v) => (
        <Card key={v.vin} v={v} />
      ))}
    </div>
  );
};

export default ChatVehicleCards;
