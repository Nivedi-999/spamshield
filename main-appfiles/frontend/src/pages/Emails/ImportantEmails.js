// src/pages/emails/ImportantEmails.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { Label, MoreVert } from '@mui/icons-material';
import { getEmails, updateEmailTag } from '../../services/emailService';

const ImportantEmails = () => {
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const data = await getEmails(1, 100, { tag: 'important' });
      setEmails(data.emails || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTagModal = (email) => {
    setSelectedEmail(email);
    setTagModalOpen(true);
  };

  const handleTagChange = async (newTag) => {
    if (!selectedEmail) return;
    try {
      await updateEmailTag(selectedEmail.id, newTag === 'none' ? null : newTag);
      fetchEmails(); // Refresh
    } catch (err) {
      console.error('Tag failed:', err);
    } finally {
      setTagModalOpen(false);
      setSelectedEmail(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Important Emails</Typography>

      <Paper sx={{ mb: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Sender</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Tag</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">No important emails</TableCell>
                </TableRow>
              ) : (
                emails.map((email) => (
                  <TableRow
                    key={email.id}
                    hover
                    onClick={() => navigate(`/email/${email.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{email.sender}</TableCell>
                    <TableCell>{email.subject || '(No Subject)'}</TableCell>
                    <TableCell>
                      <Chip
                        label={email.is_phishing ? 'Phishing' : 'Safe'}
                        color={email.is_phishing ? 'error' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => handleOpenTagModal(email)}>
                        <Label
                          fontSize="small"
                          color={email.tag === 'important' ? 'primary' : 'action'}
                        />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* TAG MODAL */}
      <Dialog open={tagModalOpen} onClose={() => setTagModalOpen(false)}>
        <DialogTitle>Tag: {selectedEmail?.sender}</DialogTitle>
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
            <ToggleButton value="none">Remove</ToggleButton>
          </ToggleButtonGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagModalOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImportantEmails;