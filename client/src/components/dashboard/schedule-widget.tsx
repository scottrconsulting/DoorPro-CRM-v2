import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Schedule } from "@shared/schema";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface ScheduleWidgetProps {
  title?: string;
}

export default function ScheduleWidget({ title = "Today's Schedule" }: ScheduleWidgetProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Fetch schedules
  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });

  // Filter schedules for selected date
  const todaySchedules = useMemo(() => {
    return schedules
      .filter((schedule) => {
        const scheduleDate = parseISO(schedule.startTime.toString());
        return isSameDay(scheduleDate, selectedDate);
      })
      .sort((a, b) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
  }, [schedules, selectedDate]);

  // Format date for display
  const formattedDate = format(selectedDate, "EEEE, MMM d");

  // Navigate to previous/next day
  const handlePreviousDay = () => setSelectedDate(addDays(selectedDate, -1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));

  // Calculate totals
  const totalHouses = useMemo(() => {
    return todaySchedules.reduce((total, schedule) => {
      if (schedule.type === "route" && schedule.contactIds) {
        return total + schedule.contactIds.length;
      }
      return total;
    }, 0);
  }, [todaySchedules]);

  // Get badge color based on schedule type
  const getScheduleBadgeColor = (type: string) => {
    switch (type) {
      case "route":
        return "bg-blue-50 border-l-4 border-primary";
      case "follow_up":
        return "bg-green-50 border-l-4 border-success";
      case "appointment":
        return "bg-yellow-50 border-l-4 border-warning";
      default:
        return "bg-neutral-50 border-l-4 border-neutral-400";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
      <div className="border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
        <h2 className="font-medium text-neutral-800">{title}</h2>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-neutral-800">{formattedDate}</div>
          <div className="flex">
            <button
              onClick={handlePreviousDay}
              className="p-1 text-neutral-400 hover:text-neutral-600"
            >
              <span className="material-icons text-sm">chevron_left</span>
            </button>
            <button
              onClick={handleNextDay}
              className="p-1 text-neutral-600 hover:text-neutral-800"
            >
              <span className="material-icons text-sm">chevron_right</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : todaySchedules.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-neutral-500">No schedules for this day</p>
            <Link href="/schedule" className="mt-2 text-sm text-primary hover:underline">
              Add a schedule
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {todaySchedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`flex items-center p-2 rounded ${getScheduleBadgeColor(schedule.type)}`}
              >
                <div className="flex-shrink-0 mr-3 text-center">
                  <div className="text-xs text-neutral-500">
                    {format(parseISO(schedule.startTime.toString()), "h:mm a")}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {format(parseISO(schedule.endTime.toString()), "h:mm a")}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-neutral-800">{schedule.title}</h4>
                  <div className="text-xs text-neutral-600">{schedule.description}</div>
                  {schedule.type === "route" && schedule.contactIds && (
                    <div className="text-xs text-neutral-600">
                      {schedule.contactIds.length} houses planned
                    </div>
                  )}
                </div>
              </div>
            ))}

            {todaySchedules.length > 0 && (
              <>
                <div className="border-t border-neutral-200 my-4"></div>

                <div className="text-sm text-neutral-600">
                  <div className="flex items-center justify-between">
                    <span>Total houses planned:</span>
                    <span className="font-medium">{totalHouses}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Estimated completion:</span>
                    <span className="font-medium">
                      {todaySchedules.length > 0 && format(parseISO(todaySchedules[todaySchedules.length - 1].endTime.toString()), "h:mm a")}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200 px-4 py-3 bg-neutral-50">
        <Link href="/schedule" className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md text-sm text-neutral-700 hover:bg-neutral-50 flex items-center justify-center">
          <span className="material-icons text-sm mr-1">add</span> Add Appointment
        </Link>
      </div>
    </div>
  );
}
