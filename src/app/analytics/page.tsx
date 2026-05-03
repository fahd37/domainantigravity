"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsData {
  summary: {
    totalScanned: number;
    avgScore: string;
    buyRate: string;
    totalSpent: number;
  };
  velocity: { date: string; count: number }[];
  scoreDistribution: { range: string; count: number }[];
  nicheDistribution: { niche: string; count: number }[];
  rejectionReasons: { reason: string; count: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetch("/api/analytics/stats")
      .then(res => res.json())
      .then(json => {
        if (!json.error) setData(json);
      })
      .catch(console.error);
  }, []);

  if (!data) return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading analytics...</div>;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics & ROI</h1>
        <p className="text-muted-foreground mt-2">
          Track the value of your acquired domains over time.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="tracking-tight text-sm font-medium pb-2 text-muted-foreground">Total Scanned</h3>
          <div className="text-2xl font-bold">{data.summary.totalScanned}</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="tracking-tight text-sm font-medium pb-2 text-muted-foreground">Average Score</h3>
          <div className="text-2xl font-bold">{data.summary.avgScore}</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="tracking-tight text-sm font-medium pb-2 text-muted-foreground">Buy Rate</h3>
          <div className="text-2xl font-bold">{data.summary.buyRate}%</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="tracking-tight text-sm font-medium pb-2 text-muted-foreground">Total Spent</h3>
          <div className="text-2xl font-bold">${data.summary.totalSpent.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm h-96 flex flex-col">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold leading-none tracking-tight">Acquisition Velocity (30 Days)</h3>
          </div>
          <div className="flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.velocity}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{fontSize: 10}} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm h-96 flex flex-col">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold leading-none tracking-tight">Score Distribution</h3>
          </div>
          <div className="flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm h-96 flex flex-col">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold leading-none tracking-tight">Niche Distribution</h3>
          </div>
          <div className="flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.nicheDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="niche"
                >
                  {data.nicheDistribution.map((entry, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm h-96 flex flex-col">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold leading-none tracking-tight">Top Rejection Reasons</h3>
          </div>
          <div className="flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.rejectionReasons} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" />
                <YAxis dataKey="reason" type="category" width={120} tick={{fontSize: 10}} />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
