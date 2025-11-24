import React, { useEffect, useState } from 'react';
import { Truck, Clock, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ActiveTrip {
    id: string;
    vehicle_plate: string;
    vehicle_make?: string;
    vehicle_model?: string;
    driver_name: string;
    checkout_time: string;
    destination?: string;
    odometer_start: number;
}

export const ActiveVehiclesTicker: React.FC = () => {
    const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActiveTrips();

        // Refresh every 30 seconds
        const interval = setInterval(fetchActiveTrips, 30000);

        return () => clearInterval(interval);
    }, []);

    const fetchActiveTrips = async () => {
        try {
            // TODO: Replace with actual trip_logs query when table is created
            // For now, we'll use a placeholder
            // const { data, error } = await supabase
            //   .from('trip_logs')
            //   .select(`
            //     id,
            //     odometer_start,
            //     checkout_time,
            //     destination,
            //     vehicles (plate, make, model),
            //     profiles (full_name)
            //   `)
            //   .eq('status', 'checked_out')
            //   .order('checkout_time', { ascending: false });

            // Placeholder data for demonstration
            const placeholderData: ActiveTrip[] = [
                {
                    id: '1',
                    vehicle_plate: 'กข 1234',
                    vehicle_make: 'Toyota',
                    vehicle_model: 'Hilux Revo',
                    driver_name: 'สมชาย ใจดี',
                    checkout_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    destination: 'ลาดกระบัง',
                    odometer_start: 45230,
                },
                {
                    id: '2',
                    vehicle_plate: 'คง 5678',
                    vehicle_make: 'Isuzu',
                    vehicle_model: 'D-Max',
                    driver_name: 'สมหญิง รักงาน',
                    checkout_time: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
                    destination: 'บางนา',
                    odometer_start: 32100,
                },
                {
                    id: '3',
                    vehicle_plate: 'จฉ 9012',
                    vehicle_make: 'Mitsubishi',
                    vehicle_model: 'Triton',
                    driver_name: 'สมศักดิ์ ขยัน',
                    checkout_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                    destination: 'สมุทรปราการ',
                    odometer_start: 28900,
                },
            ];

            setActiveTrips(placeholderData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching active trips:', error);
            setLoading(false);
        }
    };

    const getTimeElapsed = (checkoutTime: string) => {
        const now = new Date();
        const checkout = new Date(checkoutTime);
        const diffMs = now.getTime() - checkout.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHours > 0) {
            return `${diffHours} ชม. ${diffMinutes} นาที`;
        }
        return `${diffMinutes} นาที`;
    };

    if (loading || activeTrips.length === 0) {
        return null;
    }

    // Duplicate items for seamless loop
    const duplicatedTrips = [...activeTrips, ...activeTrips, ...activeTrips];

    return (
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 py-3 shadow-lg">
            {/* Animated ticker */}
            <div className="ticker-wrapper">
                <div className="ticker-content">
                    {duplicatedTrips.map((trip, index) => (
                        <div
                            key={`${trip.id}-${index}`}
                            className="ticker-item inline-flex items-center gap-4 px-8 text-white"
                        >
                            {/* Vehicle Icon */}
                            <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                                <Truck className="w-5 h-5" />
                                <span className="font-bold text-lg">{trip.vehicle_plate}</span>
                            </div>

                            {/* Vehicle Model */}
                            <span className="text-sm opacity-90">
                                {trip.vehicle_make} {trip.vehicle_model}
                            </span>

                            {/* Driver */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-white/10 px-3 py-1 rounded-full">
                                    👤 {trip.driver_name}
                                </span>
                            </div>

                            {/* Destination */}
                            {trip.destination && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    <span className="text-sm">{trip.destination}</span>
                                </div>
                            )}

                            {/* Time Elapsed */}
                            <div className="flex items-center gap-1 bg-yellow-500/30 px-3 py-1 rounded-full">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                    {getTimeElapsed(trip.checkout_time)}
                                </span>
                            </div>

                            {/* Separator */}
                            <div className="w-px h-8 bg-white/30 mx-4"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Gradient overlays for smooth fade effect */}
            <div className="absolute top-0 left-0 h-full w-32 bg-gradient-to-r from-blue-600 to-transparent dark:from-blue-800 pointer-events-none z-10"></div>
            <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-blue-700 to-transparent dark:from-blue-900 pointer-events-none z-10"></div>

            <style jsx>{`
        .ticker-wrapper {
          width: 100%;
          overflow: hidden;
        }

        .ticker-content {
          display: inline-flex;
          animation: ticker 60s linear infinite;
          will-change: transform;
        }

        .ticker-item {
          flex-shrink: 0;
          white-space: nowrap;
        }

        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }

        /* Pause on hover */
        .ticker-wrapper:hover .ticker-content {
          animation-play-state: paused;
        }

        /* Smooth animation */
        @media (prefers-reduced-motion: reduce) {
          .ticker-content {
            animation: none;
          }
        }
      `}</style>
        </div>
    );
};
