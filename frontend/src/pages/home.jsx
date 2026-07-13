import React, { useContext, useState } from 'react'
import withAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom'
import { Button, IconButton, TextField, Alert, CircularProgress } from '@mui/material'
import RestoreIcon from '@mui/icons-material/Restore'
import LogoutIcon from '@mui/icons-material/Logout'
import { AuthContext } from '../contexts/authContextObject'
import styles from "../styles/home.module.css"

function HomeComponent() {
    const navigate = useNavigate()
    const [meetingCode, setMeetingCode] = useState("")
    const [error, setError] = useState("")
    const [joining, setJoining] = useState(false)
    const { addToUserHistory } = useContext(AuthContext)

    const handleJoinVideoCall = async () => {
        const code = meetingCode.trim()
        if (!code) {
            setError("Please enter a meeting code.")
            return
        }

        setError("")
        setJoining(true)
        try {
            await addToUserHistory(code)
            navigate(`/${code}`)
        } catch {
            setError("Couldn't join the meeting. Please try again.")
            setJoining(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleJoinVideoCall()
    }

    return (
        <>
            <div className={styles.navBar}>
                <div className={styles.navLogo}>
                    <h2>Meetify</h2>
                </div>
                <div className={styles.navActions}>
                    <div
                        className={styles.historyAction}
                        onClick={() => navigate("/history")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && navigate("/history")}
                    >
                        <RestoreIcon />
                        <span>History</span>
                    </div>
                    <Button
                        className={styles.logoutBtn}
                        onClick={() => { localStorage.removeItem("token"); navigate("/") }}
                        variant="contained"
                        startIcon={<LogoutIcon />}
                    >
                        Logout
                    </Button>
                </div>
            </div>

            <div className={styles.meetContainer}>
                <div className={styles.leftPanel}>
                    <h2>Providing Quality Video Calls, Just Like Quality Education</h2>
                    <p className={styles.subtitle}>Enter a meeting code to join, or share one with others to bring them in.</p>
                    <div className={styles.joinBox}>
                        <TextField
                            id="meeting-code-input"
                            onChange={e => { setMeetingCode(e.target.value); setError("") }}
                            onKeyDown={handleKeyDown}
                            value={meetingCode}
                            label="Meeting Code"
                            variant="outlined"
                            error={Boolean(error)}
                            fullWidth
                        />
                        <Button
                            onClick={handleJoinVideoCall}
                            variant='contained'
                            disabled={joining}
                            startIcon={joining ? <CircularProgress size={18} color="inherit" /> : null}
                        >
                            {joining ? "Joining…" : "Join"}
                        </Button>
                    </div>
                    {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
                </div>
                <div className={styles.rightPanel}>
                    <img src='/logo3.png' alt="Meetify Logo" />
                </div>
            </div>
        </>
    )
}

const HomeWithAuth = withAuth(HomeComponent)
export default HomeWithAuth
