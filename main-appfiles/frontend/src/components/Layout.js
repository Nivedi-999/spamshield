import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Button,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  ExitToApp as LogoutIcon,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { logout } from '../services/authService';
import { syncEmails } from '../services/emailService';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';

const drawerWidth = 240;

const Layout = ({ user, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await syncEmails();
      window.location.reload();
    } catch (error) {
      console.error('Error syncing emails:', error);
    } finally {
      setSyncing(false);
    }
  };

  const drawer = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background:
          theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, #1e1e1e 0%, #252525 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)',
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 2,
        }}
      >
        <Logo size="medium" />
      </Toolbar>
      <Divider />

      {/* User Profile Section */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Avatar
          src={user?.profile_pic}
          alt={user?.name || 'User'}
          sx={{
            width: 64,
            height: 64,
            mb: 1,
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            border: '2px solid',
            borderColor: 'primary.main',
          }}
        />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {user?.name || 'User'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {user?.email}
        </Typography>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <List sx={{ flexGrow: 1, px: 1 }}>
        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemButton
            selected={location.pathname === '/dashboard' || location.pathname === '/'}
            onClick={() => navigate('/dashboard')}
            sx={{ borderRadius: 2 }}
          >
            <ListItemIcon>
              <DashboardIcon
                color={location.pathname === '/dashboard' || location.pathname === '/' ? 'primary' : 'inherit'}
              />
            </ListItemIcon>
            <ListItemText
              primary="Dashboard"
              primaryTypographyProps={{
                fontWeight: location.pathname === '/dashboard' || location.pathname === '/' ? 600 : 400,
              }}
            />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemButton
            selected={location.pathname === '/settings'}
            onClick={() => navigate('/settings')}
            sx={{ borderRadius: 2 }}
          >
            <ListItemIcon>
              <SettingsIcon color={location.pathname === '/settings' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText
              primary="Settings"
              primaryTypographyProps={{ fontWeight: location.pathname === '/settings' ? 600 : 400 }}
            />
          </ListItemButton>
        </ListItem>
      </List>

      <Box sx={{ p: 2 }}>
        <Button
          variant="outlined"
          color="primary"
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ borderRadius: 2 }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {location.pathname === '/dashboard' || location.pathname === '/' ? 'Dashboard' :
             location.pathname === '/settings' ? 'Settings' : ''}
          </Typography>

          <Tooltip title="Search">
            <IconButton color="inherit" sx={{ mr: 1 }}>
              <SearchIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Filter">
            <IconButton color="inherit" sx={{ mr: 1 }}>
              <FilterIcon />
            </IconButton>
          </Tooltip>

          <Button
            color="primary"
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleSync}
            disabled={syncing}
            sx={{ mr: 2 }}
          >
            {syncing ? 'Syncing...' : 'Sync Emails'}
          </Button>

          <ThemeToggle sx={{ mr: 1 }} />

          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar alt={user?.name || 'User'} src={user?.profile_pic} sx={{ width: 32, height: 32 }} />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
