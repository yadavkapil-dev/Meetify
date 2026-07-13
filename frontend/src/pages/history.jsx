import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../contexts/authContextObject'
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import { IconButton, Snackbar, Alert, Button, CircularProgress, Box, Tooltip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VideocamIcon from '@mui/icons-material/Videocam';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import styles from "../styles/history.module.css";

export default function History() {

    const { getHistoryOfUser } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorOpen, setErrorOpen] = useState(false);
    const [copiedCode, setCopiedCode] = useState("");

    const routeTo = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const history = await getHistoryOfUser();
                setMeetings(history);
            } catch {
                setErrorOpen(true);
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const year = date.getFullYear();
        return `${day}/${month}/${year}`
    }

    const handleCopy = async (code) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
        } catch {
            // Clipboard access can be denied by the browser; nothing to recover here.
        }
    }

    return (
        <div className={styles.historyContainer}>
            <div className={styles.historyHeader}>
                <IconButton onClick={() => routeTo("/home")} aria-label="Back to home">
                    <HomeIcon />
                </IconButton>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>Meeting History</Typography>
            </div>

            {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
                    <CircularProgress />
                </Box>
            )}

            {!loading && meetings.length === 0 && (
                <div className={styles.emptyState}>
                    <HistoryToggleOffIcon sx={{ fontSize: 48, color: "text.disabled" }} />
                    <Typography color="text.secondary">No meetings yet.</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Meetings you join will show up here so you can rejoin them later.
                    </Typography>
                    <Button variant="contained" sx={{ mt: 2 }} onClick={() => routeTo("/home")}>
                        Join a meeting
                    </Button>
                </div>
            )}

            {!loading && meetings.map((meeting, i) => (
                <Card key={meeting._id || i} className={styles.historyCard} variant="outlined">
                    <CardContent>
                        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
                            Code: {meeting.meetingCode}
                        </Typography>
                        <Typography sx={{ mb: 1.5 }} color="text.secondary">
                            {formatDate(meeting.date)}
                        </Typography>
                    </CardContent>
                    <CardActions>
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={<VideocamIcon />}
                            onClick={() => routeTo(`/${meeting.meetingCode}`)}
                        >
                            Rejoin
                        </Button>
                        <Tooltip title={copiedCode === meeting.meetingCode ? "Copied!" : "Copy code"}>
                            <IconButton
                                size="small"
                                aria-label="Copy meeting code"
                                onClick={() => handleCopy(meeting.meetingCode)}
                            >
                                <ContentCopyIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </CardActions>
                </Card>
            ))}

            <Snackbar
                open={errorOpen}
                autoHideDuration={4000}
                onClose={() => setErrorOpen(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="error" onClose={() => setErrorOpen(false)}>
                    Failed to fetch meeting history!
                </Alert>
            </Snackbar>

            <Snackbar
                open={Boolean(copiedCode)}
                autoHideDuration={2000}
                onClose={() => setCopiedCode("")}
                message="Meeting code copied to clipboard"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </div>
    )
}
