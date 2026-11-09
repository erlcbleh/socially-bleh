import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "../lib/queryStore";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../lib/authContext";
import { useCommunity } from "../lib/communityContext";
import { useCommunitySlug } from "../hooks/useCommunitySlug";
import { useTheme } from "../lib/themeContext";
import { api } from "../lib/api";
import FlickerSpinner from "../components/shared/FlickerSpinner";
import type { AnalyticsSummary } from "../types";

const COLORS = {
  light: { profileViews: "#2a78d6", impressions: "#1baf7a", clicks: "#eda100" },
  dark: { profileViews: "#3987e5", impressions: "#199e70", clicks: "#c98500" },
};

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800 sm:p-4">
      <p className="text-xs text-neutral-500 sm:text-sm">{label}</p>
      <p className="mt-1 text-lg font-medium sm:text-2xl">{value.toLocaleString()}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { community } = useCommunity();
  const slug = useCommunitySlug();
  const { theme } = useTheme();
  const colors = COLORS[theme];
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const isBusiness = user?.accountKind === "business";

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", range, slug],
    queryFn: () => api.get<AnalyticsSummary>(`/communities/${slug}/analytics/summary?range=${range}`),
    enabled: isBusiness,
  });

  if (!isBusiness) return <Navigate to="/settings/business" replace />;

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/80 p-3 backdrop-blur dark:bg-black/80">
        <h1 className="text-xl font-medium">Analytics</h1>
        <div className="flex gap-1">
          <button
            onClick={() => setRange("7d")}
            className={`rounded-full px-3 py-1 text-sm font-medium ${range === "7d" ? "bg-brand text-white" : "text-neutral-500"}`}
          >
            7 days
          </button>
          <button
            onClick={() => setRange("30d")}
            className={`rounded-full px-3 py-1 text-sm font-medium ${range === "30d" ? "bg-brand text-white" : "text-neutral-500"}`}
          >
            30 days
          </button>
        </div>
      </div>

      {isLoading && <div className="flex justify-center p-6"><FlickerSpinner /></div>}

      {data && (
        <div className="space-y-6 p-4">
          <div className="flex gap-3">
            <StatTile label="Profile views" value={data.profileViews} />
            <StatTile label="Impressions" value={data.impressions} />
            <StatTile label="Clicks" value={data.clicks} />
          </div>

          <div className="h-72 w-full rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            {data.series.length === 0 ? (
              <div className="flex h-full items-center justify-center text-neutral-400">No data in this range yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series}>
                  <CartesianGrid stroke={theme === "dark" ? "#2c2c2a" : "#e1e0d9"} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#898781"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: theme === "dark" ? "#383835" : "#c3c2b7" }}
                  />
                  <YAxis stroke="#898781" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${theme === "dark" ? "#2c2c2a" : "#e1e0d9"}`,
                      fontSize: 13,
                      background: theme === "dark" ? "#1a1a19" : "#fcfcfb",
                      color: theme === "dark" ? "#ffffff" : "#0b0b0b",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Line type="monotone" dataKey="profileViews" name="Profile views" stroke={colors.profileViews} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="impressions" name="Impressions" stroke={colors.impressions} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="clicks" name="Clicks" stroke={colors.clicks} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
