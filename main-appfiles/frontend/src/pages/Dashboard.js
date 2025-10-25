// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent,
  CircularProgress
} from '@mui/material';
import { Email, Warning, CheckCircle } from '@mui/icons-material';
import { getEmailStats, getPhishingTrends } from '../services/emailService';
import { Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, ArcElement);

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_emails: 0,
    phishing_emails: 0,
    phishing_percentage: 0
  });
  const [phishingTrends, setPhishingTrends] = useState({ labels: [], datasets: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsData, trendsData] = await Promise.all([
          getEmailStats(),
          getPhishingTrends()
        ]);
        setStats(statsData);
        setPhishingTrends(trendsData);
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const pieData = {
    labels: ['Safe Emails', 'Phishing Emails'],
    datasets: [{
      data: [stats.total_emails - stats.phishing_emails, stats.phishing_emails],
      backgroundColor: ['#4caf50', '#f44336'],
      borderWidth: 1,
    }]
  };

  const onLegendClick = (e, legendItem, legend) => {
    const index = legendItem.datasetIndex;
    const ci = legend.chart;
    const meta = ci.getDatasetMeta(index);
    meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
    ci.update();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Email Dashboard</Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>Total Emails</Typography>
                  <Typography variant="h4">{stats.total_emails}</Typography>
                  <Email color="primary" sx={{ fontSize: 40, mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>Phishing Emails</Typography>
                  <Typography variant="h4">{stats.phishing_emails}</Typography>
                  <Warning color="error" sx={{ fontSize: 40, mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>Safe Emails</Typography>
                  <Typography variant="h4">{stats.total_emails - stats.phishing_emails}</Typography>
                  <CheckCircle color="success" sx={{ fontSize: 40, mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>Phishing Rate</Typography>
                  <Typography variant="h4">{stats.phishing_percentage.toFixed(1)}%</Typography>
                  <Box sx={{ mt: 1, height: 40 }}>
                    <Box sx={{ height: 8, borderRadius: 5, bgcolor: '#e0e0e0', position: 'relative', mt: 2 }}>
                      <Box
                        sx={{
                          height: '100%',
                          borderRadius: 5,
                          bgcolor: stats.phishing_percentage > 50 ? 'error.main' :
                                   stats.phishing_percentage > 20 ? 'warning.main' : 'success.main',
                          width: `${Math.min(stats.phishing_percentage, 100)}%`,
                        }}
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Email Safety Overview</Typography>
                <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
                  {stats.total_emails > 0 ? (
                    <Pie data={pieData} options={{ maintainAspectRatio: false }} />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <Typography variant="body1" color="textSecondary">No email data available</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Phishing & Safe Trends</Typography>
                <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
                  {phishingTrends.labels?.length > 0 ? (
                    <Line
                      data={phishingTrends}
                      options={{
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, title: { display: true, text: 'Rate (%)' }, max: 100 } },
                        plugins: { legend: { display: true, position: 'top', onClick: onLegendClick } },
                      }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <Typography variant="body1" color="textSecondary">No trends data</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default Dashboard;