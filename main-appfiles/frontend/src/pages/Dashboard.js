import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import { getEmails, getEmailStats, deleteEmail } from '../services/emailService';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import EmailStatsChart from '../components/EmailStats';  // ✅ make sure filename matches

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

const Dashboard = () => {
  const navigate = useNavigate();

  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState({
    total_emails: 0,
    phishing_emails: 0,
    phishing_percentage: 0,
    trends: [], // ✅ for line chart
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filter, setFilter] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const filters = filter !== null ? { is_phishing: filter } : {};
        const emailsData = await getEmails(page + 1, rowsPerPage, filters);
        setEmails(emailsData.emails || []);

        const statsData = await getEmailStats();
        setStats(statsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [page, rowsPerPage, filter]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleEmailClick = (id) => {
    navigate(`/email/${id}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Delete email permanently (only from SpamShield DB)
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      'Are you sure you want to permanently delete this email from SpamShield?'
    );
    if (!confirmDelete) return;

    try {
      await deleteEmail(id);
      setEmails((prevEmails) => prevEmails.filter((email) => email.id !== id));
      alert('Email deleted from SpamShield.');
    } catch (error) {
      console.error('Error deleting email:', error);
      alert('Failed to delete the email. Please try again later.');
    }
  };

  // Chart data for pie chart
  const chartData = {
    labels: ['Safe Emails', 'Phishing Emails'],
    datasets: [
      {
        data: [stats.total_emails - stats.phishing_emails, stats.phishing_emails],
        backgroundColor: ['#4caf50', '#f44336'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <>
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          Email Dashboard
        </Typography>

        {/* Stats Grid */}
        <Grid container spacing={3} mb={3}>
          <Grid item xs={10} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6">Total Emails</Typography>
                <Typography variant="h4">{stats.total_emails}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={10} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6">Phishing Emails</Typography>
                <Typography variant="h4">{stats.phishing_emails}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={10} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6">Safe Emails</Typography>
                <Typography variant="h4">
                  {stats.total_emails - stats.phishing_emails}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={10} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6">Phishing Rate</Typography>
                <Typography
                  variant="h4"
                  color={
                    stats.phishing_percentage > 50
                      ? 'error.main'
                      : stats.phishing_percentage > 20
                      ? 'warning.main'
                      : 'success.main'
                  }
                >
                  {stats.phishing_percentage.toFixed(1)}%
                </Typography>
                <Box
                  mt={1}
                  height={10}
                  borderRadius={5}
                  bgcolor="grey.300"
                  sx={{ width: '100%', overflow: 'hidden' }}
                >
                  <Box
                    height={10}
                    bgcolor={
                      stats.phishing_percentage > 50
                        ? 'error.main'
                        : stats.phishing_percentage > 20
                        ? 'warning.main'
                        : 'success.main'
                    }
                    sx={{ width: `${Math.min(stats.phishing_percentage, 100)}%` }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts */}
        <Grid container spacing={3} mb={3} justifyContent="center">
          <Grid item xs={10} md={5}>
            <Typography variant="h6" mb={2}>
              Email Safety Overview
            </Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              {stats.total_emails > 0 ? (
                <Pie
                  data={chartData}
                  width={300}
                  height={300}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                  }}
                />
              ) : (
                <Typography>No email data available</Typography>
              )}
            </Box>
          </Grid>

          <Grid item xs={10} md={5} sx={{ ml: { xs: 0, md: 2 } }}>
            <Typography variant="h6" mb={2}>
              Emails Over Time
            </Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              {stats.trends && stats.trends.length > 0 ? (
                <EmailStatsChart data={stats.trends} />
              ) : (
                <Typography>No trend data available</Typography>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Filter Buttons */}
        <Box mb={2}>
          <Button
            variant={filter === null ? 'contained' : 'outlined'}
            onClick={() => setFilter(null)}
            sx={{ mr: 1 }}
          >
            All
          </Button>
          <Button
            variant={filter === true ? 'contained' : 'outlined'}
            color="error"
            onClick={() => setFilter(true)}
            sx={{ mr: 1 }}
          >
            Phishing
          </Button>
          <Button
            variant={filter === false ? 'contained' : 'outlined'}
            color="success"
            onClick={() => setFilter(false)}
          >
            Safe
          </Button>
        </Box>

        {/* Recent Emails Table */}
        <Paper>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Sender</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Received</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : emails.length > 0 ? (
                  emails.map((email) => (
                    <TableRow key={email.id} hover>
                      <TableCell
                        onClick={() => handleEmailClick(email.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {email.sender}
                      </TableCell>
                      <TableCell
                        onClick={() => handleEmailClick(email.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {email.subject || '(No Subject)'}
                      </TableCell>
                      <TableCell
                        onClick={() => handleEmailClick(email.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {formatDate(email.received_date)}
                      </TableCell>
                      <TableCell
                        onClick={() => handleEmailClick(email.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {email.is_phishing ? 'Phishing' : 'Safe'}
                      </TableCell>
                      <TableCell
                        onClick={() => handleEmailClick(email.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {email.is_phishing
                          ? `${email.phishing_score.toFixed(1)}%`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleDelete(email.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No emails found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={stats.total_emails}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </Box>
    </>
  );
};

export default Dashboard;
