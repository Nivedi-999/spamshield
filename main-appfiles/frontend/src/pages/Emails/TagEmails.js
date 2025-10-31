// src/pages/Emails/TagEmails.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Chip,
  IconButton, Button, CircularProgress
} from '@mui/material';
import { MoreVert, Refresh, LabelImportant, PriorityHigh, Coffee, Reply } from '@mui/icons-material';
import { getEmails, updateEmailStatus } from '../../services/emailService';
import AdvancedSearch from '../../components/AdvancedSearch';

const tagConfig = {
  important: { label: 'Important', color: 'error', icon: <LabelImportant /> },
  urgent: { label: 'Urgent', color: 'warning', icon: <PriorityHigh /> },
  casual: { label: 'Casual', color: 'info', icon: <Coffee /> },
  'no-reply': { label: 'No Reply', color: 'secondary', icon: <Reply /> },
};

const TagEmails = ({ tag }) => {
  const navigate = useNavigate();
  const config = tagConfig[tag];

  const [emails, setEmails] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchFilters, setSearchFilters] = useState({});

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const filters = { tag, ...searchFilters };
      const data = await getEmails(page + 1, rowsPerPage, filters);
      setEmails(data.emails || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error(`Error fetching ${tag} emails:`, error);
      setEmails([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [page, rowsPerPage, searchFilters]);

  const handleStatusChange = (emailId, currentStatus) => {
    if (window.confirm(`Mark as ${currentStatus ? 'Safe' : 'Phishing'}?`)) {
      updateEmailStatus(emailId, !currentStatus)
        .then(() => fetchEmails())
        .catch(() => alert('Failed to update status'));
    }
  };

  const formatDate = (date) => new Date(date).toLocaleString();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {config.label} Emails
      </Typography>

      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchEmails}>
          Refresh
        </Button>
      </Box>

      <AdvancedSearch onSearch={(filters) => {
        setSearchFilters(filters);
        setPage(0);
      }} />

      <Paper sx={{ mt: 3 }}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
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
                  {emails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        <Typography color="textSecondary">
                          No {config.label.toLowerCase()} emails found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    emails.map((email) => (
                      <TableRow
                        key={email.id}
                        hover
                        onClick={() => navigate(`/email/${email.id}`)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            onClick={() => handleStatusChange(email.id, email.is_phishing)}
                          >
                            <MoreVert />
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
                          <Chip
                            label={config.label}
                            color={config.color}
                            size="small"
                            icon={config.icon}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={total}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, p) => setPage(p)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </Paper>
    </Box>
  );
};

export default TagEmails;