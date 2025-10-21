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
  Chip,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { 
  Email as EmailIcon, 
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { 
  getEmails, 
  getEmailStats, 
  updateEmailTag,
  updateEmailStatus,
  getPhishingTrends,
} from '../services/emailService';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import AdvancedSearch from '../components/AdvancedSearch';

// Register Chart.js components
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, ArcElement);

const Dashboard = () => {
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState({
    total_emails: 0,
    phishing_emails: 0,
    phishing_percentage: 0,
    detection_methods: {
      ml: 0,
      ai: 0,
      rules: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filter, setFilter] = useState(null);
  const [searchFilters, setSearchFilters] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [newStatus, setNewStatus] = useState(false);
  const [phishingTrends, setPhishingTrends] = useState({ labels: [], datasets: [] });

  // Handler for Advanced Search
  const handleAdvancedSearch = (filters) => {
    setSearchFilters(filters);
    setPage(0);
  };

  // Handler for individual email tag change
  const handleTagChange = async (emailId, newTag) => {
    try {
      await updateEmailTag(emailId, newTag);
      window.location.reload();
    } catch (error) {
      console.error('Failed to update tag:', error);
    }
  };

  // Handler for status change confirmation
  const handleStatusChange = (emailId, currentStatus) => {
    setSelectedEmailId(emailId);
    setNewStatus(!currentStatus);
    setOpenDialog(true);
  };

  // Handle dialog confirmation
  const handleConfirmStatusChange = async () => {
    if (selectedEmailId !== null) {
      try {
        await updateEmailStatus(selectedEmailId, newStatus);
        window.location.reload();
      } catch (error) {
        console.error('Failed to update status:', error);
      }
    }
    setOpenDialog(false);
  };

  // Handle dialog cancellation
  const handleCancelStatusChange = () => {
    setOpenDialog(false);
  };

  // Custom legend click handler to toggle dataset visibility
  const onLegendClick = (e, legendItem, legend) => {
    const index = legendItem.datasetIndex;
    const ci = legend.chart;
    const meta = ci.getDatasetMeta(index);
    meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
    ci.update();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Merge advanced search filters and simple toggle
        const appliedFilters = { ...searchFilters };

        if (filter === true || filter === false) {
          appliedFilters.is_phishing = filter;
        }

        // Fetch emails
        const emailsData = await getEmails(page + 1, rowsPerPage, appliedFilters);
        setEmails(emailsData.emails || []);

        // Fetch stats
        const statsData = await getEmailStats();
        setStats(statsData);

        // Fetch phishing + safe trends
        const trendsData = await getPhishingTrends();
        setPhishingTrends(trendsData);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page, rowsPerPage, filter, searchFilters]);

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

  // Pie chart data
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
    <Box>
      <Typography variant="h4" gutterBottom>
        Email Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Emails
              </Typography>
              <Typography variant="h4" component="div">
                {stats.total_emails}
              </Typography>
              <EmailIcon color="primary" sx={{ fontSize: 40, mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Phishing Emails
              </Typography>
              <Typography variant="h4" component="div">
                {stats.phishing_emails}
              </Typography>
              <WarningIcon color="error" sx={{ fontSize: 40, mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Safe Emails
              </Typography>
              <Typography variant="h4" component="div">
                {stats.total_emails - stats.phishing_emails}
              </Typography>
              <CheckCircleIcon color="success" sx={{ fontSize: 40, mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Phishing Rate
              </Typography>
              <Typography variant="h4" component="div">
                {stats.phishing_percentage.toFixed(1)}%
              </Typography>
              <Box sx={{ mt: 1, height: 40 }}>
                <Box
                  sx={{
                    height: 8,
                    borderRadius: 5,
                    bgcolor: '#e0e0e0',
                    position: 'relative',
                    mt: 2,
                  }}
                >
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
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Pie Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Email Safety Overview
            </Typography>
            <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
              {stats.total_emails > 0 ? (
                <Pie data={chartData} options={{ maintainAspectRatio: false }} />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="body1" color="textSecondary">
                    No email data available
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Line Chart with Safe Rate */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Phishing & Safe Trends Over Time
            </Typography>
            <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
              {phishingTrends.labels && phishingTrends.labels.length > 0 ? (
                <Line
                  data={phishingTrends}
                  options={{
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Rate (%)' },
                        max: 100,
                      },
                      x: {
                        title: { display: true, text: 'Date' },
                      },
                    },
                    plugins: {
                      legend: {
                        display: true,
                        position: 'top',
                        onClick: onLegendClick, // Enable toggling
                      },
                    },
                  }}
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="body1" color="textSecondary">
                    No trends data available
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Email List */}
      <AdvancedSearch onSearch={handleAdvancedSearch} />
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Recent Emails
          </Typography>
          <Box>
            <Button 
              variant={filter === null ? "contained" : "outlined"} 
              size="small" 
              onClick={() => setFilter(null)}
              sx={{ mr: 1 }}
            >
              All
            </Button>
            <Button 
              variant={filter === true ? "contained" : "outlined"} 
              color="error"
              size="small" 
              onClick={() => setFilter(true)}
              sx={{ mr: 1 }}
            >
              Phishing
            </Button>
            <Button 
              variant={filter === false ? "contained" : "outlined"} 
              color="success"
              size="small" 
              onClick={() => setFilter(false)}
            >
              Safe
            </Button>
          </Box>
        </Box>
        <Divider />
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Actions</TableCell>
                    <TableCell>Sender</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Received</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Tag</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emails.length > 0 ? (
                    emails.map((email) => (
                      <TableRow
                        key={email.id}
                        hover
                        onClick={() => handleEmailClick(email.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(email.id, email.is_phishing);
                            }}
                            size="small"
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                        <TableCell>{email.sender}</TableCell>
                        <TableCell>{email.subject || '(No Subject)'}</TableCell>
                        <TableCell>{formatDate(email.received_date)}</TableCell>
                        <TableCell>
                          <Chip
                            label={email.is_phishing ? 'Phishing' : 'Safe'}
                            color={email.is_phishing ? 'error' : 'success'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {email.is_phishing ? `${email.phishing_score?.toFixed(1)}%` : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={email.tag || 'none'}
                            onChange={(e) => handleTagChange(email.id, e.target.value)}
                            size="small"
                            sx={{ minWidth: 120 }}
                          >
                            <MenuItem value="none">None</MenuItem>
                            <MenuItem value="important">Important</MenuItem>
                            <MenuItem value="urgent">Urgent</MenuItem>
                            <MenuItem value="casual">Casual</MenuItem>
                            <MenuItem value="no-reply">No Reply</MenuItem>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body1" sx={{ py: 2 }}>
                          No emails found
                        </Typography>
                        <Button
                          variant="outlined"
                          startIcon={<RefreshIcon />}
                          onClick={() => window.location.reload()}
                        >
                          Refresh
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={-1}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCancelStatusChange}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {`Change Status to ${newStatus ? 'Phishing' : 'Safe'}?`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to change the status of this email? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelStatusChange} color="primary">
            No
          </Button>
          <Button onClick={handleConfirmStatusChange} color="primary" autoFocus>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;