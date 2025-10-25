// src/pages/Emails/AllEmails.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { TagFilterContext } from '../../contexts/TagFilterContext';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Chip,
  IconButton, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, ToggleButtonGroup, ToggleButton,
  DialogContentText
} from '@mui/material';
import { MoreVert, Refresh, Label } from '@mui/icons-material'; // ← SyncIcon REMOVED
import { getEmails, updateEmailStatus, updateEmailTag } from '../../services/emailService'; // ← syncEmails REMOVED
import AdvancedSearch from '../../components/AdvancedSearch';

const AllEmails = () => {
  const navigate = useNavigate();
  const { selectedTag } = useContext(TagFilterContext);

  const [emails, setEmails] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchFilters, setSearchFilters] = useState({});

  // Tag Modal
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);

  // Status Change Dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusChangeEmailId, setStatusChangeEmailId] = useState(null);
  const [newStatus, setNewStatus] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const filters = { ...searchFilters };
      if (selectedTag && selectedTag !== 'all') {
        filters.tag = selectedTag;
      }

      const data = await getEmails(page + 1, rowsPerPage, filters);
      setEmails(data.emails || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [page, rowsPerPage, searchFilters, selectedTag]);

  // === STATUS CHANGE (DASHBOARD STYLE) ===
  const handleStatusChange = (emailId, currentStatus) => {
    setStatusChangeEmailId(emailId);
    setNewStatus(!currentStatus);
    setStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async () => {
  if (statusChangeEmailId === null) return;
  try {
    await updateEmailStatus(statusChangeEmailId, newStatus);
    fetchEmails();
  } catch (error) {
    alert('Failed to update status.');
    console.error('Status update failed:', error);
  } finally {
    setStatusDialogOpen(false);
    setStatusChangeEmailId(null);
  }
};

  const handleCancelStatusChange = () => {
    setStatusDialogOpen(false);
    setStatusChangeEmailId(null);
  };

  // === TAG MODAL ===
  const handleOpenTagModal = (email) => {
    setSelectedEmail(email);
    setTagModalOpen(true);
  };

  const handleTagChange = async (newTag) => {
    if (!selectedEmail) return;
    try {
      const tagValue = newTag === 'none' ? null : newTag;
      await updateEmailTag(selectedEmail.id, tagValue);
      fetchEmails();
    } catch (error) {
      console.error('Tag update failed:', error);
    } finally {
      setTagModalOpen(false);
      setSelectedEmail(null);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleString();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>All Emails</Typography>

      {/* ONLY REFRESH BUTTON */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
                        <Typography color="textSecondary">No emails found</Typography>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenTagModal(email)}
                          >
                            <Label
                              fontSize="small"
                              color={email.tag && email.tag !== 'none' ? 'primary' : 'action'}
                            />
                          </IconButton>
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

      {/* TAG MODAL */}
      <Dialog open={tagModalOpen} onClose={() => setTagModalOpen(false)}>
        <DialogTitle>Tag Sender: {selectedEmail?.sender}</DialogTitle>
        <DialogContent>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={selectedEmail?.tag || ''}
            onChange={(e, v) => v && handleTagChange(v)}
            sx={{ mt: 1 }}
          >
            <ToggleButton value="important" color="error">Important</ToggleButton>
            <ToggleButton value="urgent" color="warning">Urgent</ToggleButton>
            <ToggleButton value="casual" color="info">Casual</ToggleButton>
            <ToggleButton value="no-reply" color="secondary">No Reply</ToggleButton>
            <ToggleButton value="none">Remove Tag</ToggleButton>
          </ToggleButtonGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagModalOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* STATUS CHANGE DIALOG */}
      <Dialog
        open={statusDialogOpen}
        onClose={handleCancelStatusChange}
        aria-labelledby="status-dialog-title"
      >
        <DialogTitle id="status-dialog-title">
          Change Status to {newStatus ? 'Phishing' : 'Safe'}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to change the status of this email?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelStatusChange}>No</Button>
          <Button onClick={handleConfirmStatusChange} color="primary" autoFocus>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AllEmails;