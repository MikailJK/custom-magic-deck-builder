import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function ManaCurveChart({ data }) {
  return (
    <div style={{ height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="cmc" tick={{ fill: "var(--text-dim)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
          <Tooltip contentStyle={{ background: "#2A241C", border: "1px solid #3A3226", borderRadius: 6, fontSize: 12 }} labelStyle={{ color: "#EDE4D2" }} cursor={{ fill: "rgba(200,162,75,0.08)" }} />
          <Bar dataKey="count" fill="#C8A24B" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
