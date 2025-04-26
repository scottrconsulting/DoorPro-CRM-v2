import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  iconBgColor: string;
  trend?: {
    value: string;
    label: string;
    isPositive?: boolean;
  };
}

export default function StatCard({
  title,
  value,
  icon,
  iconBgColor,
  trend,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-neutral-200">
      <div className="flex items-center">
        <div className={`flex-shrink-0 ${iconBgColor} rounded-full p-3`}>
          <span className="material-icons text-primary">{icon}</span>
        </div>
        <div className="ml-4">
          <h3 className="text-sm font-medium text-neutral-500">{title}</h3>
          <p className="text-2xl font-bold text-neutral-800">{value}</p>
        </div>
      </div>
      {trend && (
        <div className="mt-2 text-xs text-neutral-500 flex items-center">
          <span className={`${trend.isPositive ? 'text-success' : 'text-error'} flex items-center`}>
            <span className="material-icons text-xs mr-1">
              {trend.isPositive ? 'arrow_upward' : 'arrow_downward'}
            </span>
            {trend.value}
          </span>
          <span className="ml-1">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
