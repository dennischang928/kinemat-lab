import { Box, Paper, Stack, LinearProgress, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import TuneIcon from '@mui/icons-material/Tune';
import HomeIcon from '@mui/icons-material/Home';
import PowerIcon from '@mui/icons-material/Power';
import PowerOffIcon from '@mui/icons-material/PowerOff';

const BAUD_RATES = [9600, 14400, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

/**
 * Connection status bar + connect/disconnect/baud/torque/home buttons.
 *
 * Pure presentational — all actions are delegated to the parent via props.
 */
export default function ConnectionHeader({
  isConnected,
  isLoading,
  isTorqueEnabled,
  areActionButtonsLocked,
  hasSynced,
  baudRate,
  baudMenuAnchorEl,
  onConnect,
  onDisconnect,
  onOpenBaudMenu,
  onCloseBaudMenu,
  onSelectBaudRate,
  onHome,
  onTorqueOn,
  onTorqueOff,
}) {
  return (
    <>
      <Paper
        sx={{
          m: 2,
          mb: 1,
          p: 1.5,
          bgcolor: isConnected ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${isConnected ? '#4caf50' : '#f44336'}`,
          borderRadius: 2,
          flexShrink: 0,
        }}
      >
        <Stack spacing={1.25}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress
              variant={isLoading ? 'indeterminate' : 'determinate'}
              value={isLoading ? undefined : 100}
              sx={{
                flex: 1,
                height: 10,
                borderRadius: 999,
                backgroundColor: isLoading
                  ? '#e0e0e0'
                  : isConnected
                    ? '#c8e6c9'
                    : '#ffcdd2',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 999,
                  backgroundColor: isLoading
                    ? '#1976d2'
                    : isConnected
                      ? '#4caf50'
                      : '#f44336',
                },
              }}
            />
            <IconButton
              onClick={onConnect}
              disabled={isConnected || isLoading || areActionButtonsLocked}
              sx={{ color: '#4caf50' }}
              size="large"
              aria-label="connect"
            >
              <LinkIcon />
            </IconButton>
            <IconButton
              onClick={onDisconnect}
              disabled={!isConnected || isLoading || areActionButtonsLocked}
              sx={{ color: '#f44336' }}
              size="large"
              aria-label="disconnect"
            >
              <LinkOffIcon />
            </IconButton>
            <IconButton
              onClick={onOpenBaudMenu}
              disabled={isLoading || areActionButtonsLocked}
              size="large"
              aria-label="baud-rate-settings"
            >
              <TuneIcon />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Tooltip title="Homing sequence" arrow>
              <IconButton
                onClick={onHome}
                size="large"
                color="primary"
                aria-label="home"
                disabled={!isConnected || areActionButtonsLocked}
              >
                <HomeIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Torque on" arrow>
              <IconButton
                onClick={onTorqueOn}
                size="large"
                color="primary"
                aria-label="power-on"
                disabled={!isConnected || areActionButtonsLocked}
              >
                <PowerIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Torque off" arrow>
              <IconButton
                onClick={onTorqueOff}
                size="large"
                aria-label="power-off"
                disabled={!isConnected || !isTorqueEnabled || areActionButtonsLocked || !hasSynced}
                sx={{ color: '#f44336' }}
              >
                <PowerOffIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Stack>
      </Paper>
      <Menu
        anchorEl={baudMenuAnchorEl}
        open={Boolean(baudMenuAnchorEl)}
        onClose={onCloseBaudMenu}
      >
        {BAUD_RATES.map((rate) => (
          <MenuItem
            key={rate}
            selected={baudRate === rate}
            onClick={() => onSelectBaudRate(rate)}
          >
            {rate}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
