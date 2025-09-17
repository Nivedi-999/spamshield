import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const EmailStatsChart = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="phishing" stroke="#f44336" name="Phishing Emails" />
        <Line type="monotone" dataKey="safe" stroke="#4caf50" name="Safe Emails" />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default EmailStatsChart;
