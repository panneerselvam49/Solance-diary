import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:4500/api';

function App() {
	const [token, setToken] = useState(() => {
		return localStorage.getItem('token') || '';
	});
	const [user, setUser] = useState(() => {
		try {
			const saved = localStorage.getItem('user');
			return saved ? JSON.parse(saved) : null;
		} catch (error) {
			console.error("Error parsing user from localStorage:", error);
			return null;
		}
	});

	const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'forgot_password'
	const [resetStep, setResetStep] = useState(1); // 1: Enter email, 2: Enter OTP, 3: Set New Password
	const [resetEmail, setResetEmail] = useState('');
	const [resetOTP, setResetOTP] = useState('');
	const [resetToken, setResetToken] = useState('');
	const [resetPasswordForm, setResetPasswordForm] = useState({ newPassword: '', confirmNewPassword: '' });
	const [isResetting, setIsResetting] = useState(false);
	const [authError, setAuthError] = useState('');
	const [authForm, setAuthForm] = useState({ userName: '', userEmail: '', userPassword: '' });

	// Dashboard state
	const [currentView, setCurrentView] = useState('Timeline'); // Timeline, Calendar, Insights, Settings
	const [entries, setEntries] = useState([]);
	const [selectedEntry, setSelectedEntry] = useState(null); // null means writing a new entry

	// Editor state
	const [editorDate, setEditorDate] = useState(new Date().toISOString().split('T')[0]);
	const [editorTitle, setEditorTitle] = useState('');
	const [editorNotes, setEditorNotes] = useState('');
	const [editorMood, setEditorMood] = useState(''); // plane, smiley, cog, moon
	const [isSaving, setIsSaving] = useState(false);

	// Search filter state
	const [searchQuery, setSearchQuery] = useState('');

	// Pagination states
	const [currentPage, setCurrentPage] = useState(1);
	const [totalEntriesCount, setTotalEntriesCount] = useState(0);
	const [hasMore, setHasMore] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

	// Password change state
	const [passwordForm, setPasswordForm] = useState({ existingPassword: '', newPassword: '', confirmPassword: '' });
	const [isChangingPassword, setIsChangingPassword] = useState(false);

	// Calendar Widget state
	const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

	// Toast notifications
	const [toasts, setToasts] = useState([]);

	const addToast = (message, type = 'success') => {
		const id = Date.now();
		setToasts(prev => [...prev, { id, message, type }]);
		setTimeout(() => {
			setToasts(prev => prev.filter(t => t.id !== id));
		}, 3000);
	};

	// Fetch entries
	const fetchEntries = async (currentToken) => {
		try {
			const response = await fetch(`${API_BASE}/entries?page=1&limit=20`, {
				headers: {
					'Authorization': `Bearer ${currentToken}`
				}
			});
			const data = await response.json();
			if (data.success) {
				setEntries(data.data);
				setCurrentPage(1);
				setTotalEntriesCount(data.totalEntries);
				setHasMore(data.page < data.totalPages);
			}
		} catch (error) {
			console.error("Error fetching entries:", error);
		}
	};

	const loadMoreEntries = async () => {
		if (isLoadingMore || !hasMore || !token) return;

		setIsLoadingMore(true);
		try {
			const nextPage = currentPage + 1;
			const response = await fetch(`${API_BASE}/entries?page=${nextPage}&limit=20`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});
			const data = await response.json();
			if (data.success) {
				setEntries(prev => {
					const existingIds = new Set(prev.map(e => e._id));
					const uniqueNew = data.data.filter(e => !existingIds.has(e._id));
					return [...prev, ...uniqueNew];
				});
				setCurrentPage(nextPage);
				setTotalEntriesCount(data.totalEntries);
				setHasMore(data.page < data.totalPages);
			}
		} catch (error) {
			console.error("Error loading more entries:", error);
		} finally {
			setIsLoadingMore(false);
		}
	};

	const handleSidebarScroll = (e) => {
		const { scrollTop, scrollHeight, clientHeight } = e.target;
		if (scrollHeight - scrollTop - clientHeight < 20 && hasMore && !isLoadingMore) {
			loadMoreEntries();
		}
	};

	const handleChangePassword = async (e) => {
		e.preventDefault();
		if (!passwordForm.existingPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
			addToast("Please fill in all fields", "error");
			return;
		}

		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			addToast("New passwords do not match", "error");
			return;
		}

		if (passwordForm.newPassword.length < 6) {
			addToast("Password should be at least 6 characters long", "error");
			return;
		}

		setIsChangingPassword(true);
		try {
			const response = await fetch(`${API_BASE}/auth/updatePassword`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					email: user?.userMail || '',
					existingPassword: passwordForm.existingPassword,
					newPassword: passwordForm.newPassword
				})
			});
			const data = await response.json();
			if (data.success) {
				addToast("Password updated successfully!");
				setPasswordForm({ existingPassword: '', newPassword: '', confirmPassword: '' });
			} else {
				addToast(data.message || "Failed to update password", "error");
			}
		} catch (error) {
			addToast("Server connection error", "error");
		} finally {
			setIsChangingPassword(false);
		}
	};

	useEffect(() => {
		if (token) {
			fetchEntries(token);
		}
	}, [token]);

	// Auth Handlers
	const handleAuthChange = (e) => {
		setAuthForm({ ...authForm, [e.target.name]: e.target.value });
	};

	const handleDelete = async (entryId) => {

		try {
			const response = await fetch(`${API_BASE}/entries/${entryId}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				}
			});
			const data = await response.json();
			if (data.success) {
				addToast("Entry deleted successfully!");
				if (selectedEntry && selectedEntry._id === entryId) {
					handleNewEntry();
				}
				fetchEntries(token);
			} else {
				addToast(data.message || "Failed to delete entry", "error");
			}
		} catch (error) {
			console.error("Delete entry error:", error);
			addToast("Server connection error", "error");
		}
	};

	const handleRegisterSubmit = async (e) => {
		e.preventDefault();
		setAuthError('');
		try {
			const response = await fetch(`${API_BASE}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(authForm)
			});
			const data = await response.json();
			if (data.success) {
				addToast("Registration successful! Please login.");
				setAuthMode('login');
				setAuthForm({ ...authForm, userPassword: '' });
			} else {
				setAuthError(data.message || 'Registration failed');
			}
		} catch (err) {
			setAuthError('Server error, please try again later');
		}
	};

	const handleLoginSubmit = async (e) => {
		e.preventDefault();
		setAuthError('');
		try {
			const response = await fetch(`${API_BASE}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userEmail: authForm.userEmail,
					userPassword: authForm.userPassword
				})
			});
			const data = await response.json();
			if (data.success) {
				localStorage.setItem('token', data.token);
				localStorage.setItem('user', JSON.stringify(data.user));
				setToken(data.token);
				setUser(data.user);
				addToast(`Welcome back, ${data.user.userName}!`);
			} else {
				setAuthError(data.message || 'Login failed');
			}
		} catch (err) {
			setAuthError('Server error, please try again later');
		}
	};

	const handleSendOTP = async (e) => {
		e.preventDefault();
		if (!resetEmail) {
			setAuthError("Please enter your email address.");
			return;
		}
		setAuthError('');
		setIsResetting(true);
		try {
			const response = await fetch(`${API_BASE}/auth/sendOTP`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userEmail: resetEmail })
			});
			const data = await response.json();
			if (data.success) {
				addToast("OTP sent successfully!");
				setResetStep(2);
			} else {
				setAuthError(data.message || "Failed to send OTP.");
			}
		} catch (err) {
			setAuthError("Server connection error.");
		} finally {
			setIsResetting(false);
		}
	};

	const handleVerifyOTP = async (e) => {
		e.preventDefault();
		if (!resetOTP) {
			setAuthError("Please enter the OTP.");
			return;
		}
		setAuthError('');
		setIsResetting(true);
		try {
			const response = await fetch(`${API_BASE}/auth/verifyOTP`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userEmail: resetEmail, OTP: resetOTP })
			});
			const data = await response.json();
			if (data.success) {
				addToast("OTP verified successfully!");
				setResetToken(data.resetToken);
				setResetStep(3);
			} else {
				setAuthError(data.message || "Invalid OTP.");
			}
		} catch (err) {
			setAuthError("Server connection error.");
		} finally {
			setIsResetting(false);
		}
	};

	const handleResetPassword = async (e) => {
		e.preventDefault();
		const { newPassword, confirmNewPassword } = resetPasswordForm;
		if (!newPassword || !confirmNewPassword) {
			setAuthError("Please fill in all fields.");
			return;
		}
		if (newPassword !== confirmNewPassword) {
			setAuthError("Passwords do not match.");
			return;
		}
		if (newPassword.length < 6) {
			setAuthError("Password should be at least 6 characters long.");
			return;
		}
		setAuthError('');
		setIsResetting(true);
		try {
			const response = await fetch(`${API_BASE}/auth/resetPassword`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ resetToken, newPassword })
			});
			const data = await response.json();
			if (data.success) {
				addToast("Password reset successfully! Please sign in.");
				setAuthMode('login');
				setResetStep(1);
				setResetEmail('');
				setResetOTP('');
				setResetToken('');
				setResetPasswordForm({ newPassword: '', confirmNewPassword: '' });
			} else {
				setAuthError(data.message || "Password reset failed.");
			}
		} catch (err) {
			setAuthError("Server connection error.");
		} finally {
			setIsResetting(false);
		}
	};

	const handleLogout = () => {
		localStorage.removeItem('token');
		localStorage.removeItem('user');
		setToken('');
		setUser(null);
		setEntries([]);
		setSelectedEntry(null);
		addToast("Logged out successfully");
	};

	// Editor Handlers
	const handleNewEntry = () => {
		setSelectedEntry(null);
		setEditorDate(new Date().toISOString().split('T')[0]);
		setEditorTitle('');
		setEditorNotes('');
		setEditorMood('');
		setCurrentView('Timeline');
	};

	const handleSelectEntry = (entry) => {
		setSelectedEntry(entry);
		setEditorDate(entry.createdAt ? entry.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
		setEditorTitle(entry.title || '');
		setEditorNotes(entry.notes || '');
		setEditorMood(entry.mood || '');
		setCurrentView('Timeline');
	};

	const handleSaveEntry = async () => {
		if (!editorNotes.trim()) {
			addToast("Please write something in your notes before saving", "error");
			return;
		}

		setIsSaving(true);
		try {
			const payload = {
				title: editorTitle,
				notes: editorNotes,
				mood: editorMood
			};

			let url = `${API_BASE}/entries`;
			let method = 'POST';

			if (selectedEntry) {
				url = `${API_BASE}/entries/${selectedEntry._id}`;
				method = 'PUT';
			}

			const response = await fetch(url, {
				method: method,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify(payload)
			});

			const data = await response.json();

			if (data.success) {
				addToast(selectedEntry ? "Entry updated!" : "New entry saved!");
				await fetchEntries(token);

				if (data.data) {
					setSelectedEntry(data.data);
				} else {
					setSelectedEntry(null);
				}
			} else {
				addToast(data.message || "Failed to save entry", "error");
			}
		} catch (error) {
			addToast("Server connection error", "error");
		} finally {
			setIsSaving(false);
		}
	};

	// Format Helper
	const formatDatePretty = (dateStr) => {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		}) + getOrdinalSuffix(date.getDate());
	};

	const getOrdinalSuffix = (day) => {
		if (day > 3 && day < 21) return 'th';
		switch (day % 10) {
			case 1: return "st";
			case 2: return "nd";
			case 3: return "rd";
			default: return "th";
		}
	};

	const formatSidebarDate = (dateStr) => {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	};

	// Calendar Logic
	const getDaysInMonth = (date) => {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDayIndex = new Date(year, month, 1).getDay();
		const totalDays = new Date(year, month + 1, 0).getDate();

		const days = [];
		for (let i = 0; i < firstDayIndex; i++) {
			days.push({ type: 'empty' });
		}
		const today = new Date();
		for (let i = 1; i <= totalDays; i++) {
			const currentDayDate = new Date(year, month, i);
			const isToday = currentDayDate.toDateString() === today.toDateString();

			const dayDateStr = currentDayDate.toISOString().split('T')[0];
			const matchingEntries = entries.filter(e => {
				const entryDateStr = e.createdAt ? e.createdAt.split('T')[0] : '';
				return entryDateStr === dayDateStr;
			});

			days.push({
				type: 'day',
				dayNumber: i,
				dateString: dayDateStr,
				isToday,
				hasEntry: matchingEntries.length > 0,
				entries: matchingEntries
			});
		}
		return days;
	};

	const changeMonth = (offset) => {
		setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
	};

	const handleCalendarDayClick = (day) => {
		if (day.type === 'empty') return;
		if (day.hasEntry) {
			handleSelectEntry(day.entries[0]);
		} else {
			setSelectedEntry(null);
			setEditorDate(day.dateString);
			setEditorTitle('');
			setEditorNotes('');
			setEditorMood('');
			setCurrentView('Timeline');
			addToast(`Ready to write entry for ${day.dateString}`);
		}
	};

	// Find memory
	const getMemory = () => {
		if (entries.length === 0) {
			return {
				date: "",
				title: "Autumn Nature Walk",
				notes: "Found a beautiful trail just outside the city today. The autumn leaves are finally peaking. It's amazing how much a walk in the woods can restore your sanity..."
			};
		}

		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

		const exactMemory = entries.find(e => {
			const entryDateStr = e.createdAt ? e.createdAt.split('T')[0] : '';
			return entryDateStr === oneYearAgoStr;
		});

		if (exactMemory) {
			return {
				date: formatSidebarDate(exactMemory.createdAt),
				title: exactMemory.title || "Untitled Entry",
				notes: exactMemory.notes
			};
		}

		const candidates = entries.filter(e => !selectedEntry || e._id !== selectedEntry._id);
		if (candidates.length > 0) {
			const randomEntry = candidates[candidates.length - 1];
			return {
				date: formatSidebarDate(randomEntry.createdAt),
				title: randomEntry.title || "Untitled Entry",
				notes: randomEntry.notes
			};
		}

		return {
			date: "October 23, 2022",
			title: "Autumn Nature Walk",
			notes: "Found a beautiful trail just outside the city today. The autumn leaves are finally peaking. It's amazing how much a walk in the woods can restore your sanity..."
		};
	};

	const memory = getMemory();

	// Filtering recent entries
	const filteredEntries = entries.filter(entry => {
		const titleMatch = entry.title && entry.title.toLowerCase().includes(searchQuery.toLowerCase());
		const notesMatch = entry.notes && entry.notes.toLowerCase().includes(searchQuery.toLowerCase());
		return titleMatch || notesMatch;
	});

	// Word Counter Logic
	const getWordCount = (text) => {
		if (!text) return 0;
		const cleanText = text.trim();
		if (!cleanText) return 0;
		return cleanText.split(/\s+/).length;
	};

	// Navigation Icons
	const icons = {
		timeline: (
			<svg className="nav-icon" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
			</svg>
		),
		calendar: (
			<svg className="nav-icon" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
			</svg>
		),
		insights: (
			<svg className="nav-icon" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
			</svg>
		),
		settings: (
			<svg className="nav-icon" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.645-.869l.214-1.28Z" />
				<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
			</svg>
		),
		add: (
			<svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
		),
		save: (
			<svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
			</svg>
		),
		logout: (
			<svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
			</svg>
		)
	};

	// Render Auth UI if not logged in
	if (!token) {
		return (
			<div className="auth-wrapper">
				<div className="auth-card">
					<div className="auth-logo">Solance</div>
					<div className="auth-subtitle">
						{authMode === 'forgot_password' ? 'Reset your sanctuary account password' : 'Your beautiful digital sanctuary diary'}
					</div>

					{authError && <div className="auth-error">{authError}</div>}

					{authMode !== 'forgot_password' ? (
						<>
							<form className="auth-form" onSubmit={authMode === 'register' ? handleRegisterSubmit : handleLoginSubmit}>
								{authMode === 'register' && (
									<div className="form-group">
										<label htmlFor="userName">Username</label>
										<input
											id="userName"
											type="text"
											name="userName"
											className="input-field"
											placeholder="e.g. johndoe"
											value={authForm.userName}
											onChange={handleAuthChange}
											required
										/>
									</div>
								)}

								<div className="form-group">
									<label htmlFor="userEmail">Email Address</label>
									<input
										id="userEmail"
										type='email'
										name="userEmail"
										className="input-field"
										placeholder="you@example.com"
										value={authForm.userEmail}
										onChange={handleAuthChange}
										required
									/>
								</div>

								<div className="form-group">
									<div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
										<label htmlFor="userPassword">Password</label>
										{authMode === 'login' && (
											<span
												className="auth-link"
												style={{ fontSize: '0.8rem', fontWeight: '500' }}
												onClick={() => {
													setAuthMode('forgot_password');
													setResetStep(1);
													setAuthError('');
												}}
											>
												Forgot Password?
											</span>
										)}
									</div>
									<input
										id="userPassword"
										type="password"
										name="userPassword"
										className="input-field"
										placeholder="••••••••"
										value={authForm.userPassword}
										onChange={handleAuthChange}
										required
									/>
								</div>

								<button type="submit" className="auth-btn">
									{authMode === 'register' ? 'Create Account' : 'Sign In'}
								</button>
							</form>

							<div className="auth-footer">
								{authMode === 'register' ? (
									<>Already have an account? <span className="auth-link" onClick={() => { setAuthMode('login'); setAuthError(''); }}>Sign In</span></>
								) : (
									<>New to Solance? <span className="auth-link" onClick={() => { setAuthMode('register'); setAuthError(''); }}>Create an Account</span></>
								)}
							</div>
						</>
					) : (
						<>
							{resetStep === 1 && (
								<form className="auth-form" onSubmit={handleSendOTP}>
									<div className="form-group">
										<label htmlFor="resetEmail">Email Address</label>
										<input
											id="resetEmail"
											type="email"
											className="input-field"
											placeholder="you@example.com"
											value={resetEmail}
											onChange={(e) => setResetEmail(e.target.value)}
											required
										/>
									</div>
									<button type="submit" className="auth-btn" disabled={isResetting}>
										{isResetting ? 'Sending OTP...' : 'Send Reset OTP'}
									</button>
								</form>
							)}

							{resetStep === 2 && (
								<form className="auth-form" onSubmit={handleVerifyOTP}>
									<div className="form-group" style={{ alignItems: 'center', textAlign: 'center', width: '100%' }}>
										<p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
											We sent an OTP to <strong>{resetEmail}</strong>.
										</p>
									</div>
									<div className="form-group">
										<label htmlFor="resetOTP">Enter OTP</label>
										<input
											id="resetOTP"
											type="text"
											className="input-field"
											placeholder="Enter verification code"
											value={resetOTP}
											onChange={(e) => setResetOTP(e.target.value)}
											required
										/>
									</div>
									<button type="submit" className="auth-btn" disabled={isResetting}>
										{isResetting ? 'Verifying OTP...' : 'Verify OTP'}
									</button>
									<button
										type="button"
										className="auth-btn"
										style={{ background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', marginTop: '0' }}
										onClick={handleSendOTP}
										disabled={isResetting}
									>
										Resend OTP
									</button>
								</form>
							)}

							{resetStep === 3 && (
								<form className="auth-form" onSubmit={handleResetPassword}>
									<div className="form-group">
										<label htmlFor="newPassword">New Password</label>
										<input
											id="newPassword"
											type="password"
											className="input-field"
											placeholder="••••••••"
											value={resetPasswordForm.newPassword}
											onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
											required
										/>
									</div>
									<div className="form-group">
										<label htmlFor="confirmNewPassword">Confirm New Password</label>
										<input
											id="confirmNewPassword"
											type="password"
											className="input-field"
											placeholder="••••••••"
											value={resetPasswordForm.confirmNewPassword}
											onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirmNewPassword: e.target.value })}
											required
										/>
									</div>
									<button type="submit" className="auth-btn" disabled={isResetting}>
										{isResetting ? 'Resetting Password...' : 'Reset Password'}
									</button>
								</form>
							)}

							<div className="auth-footer">
								<span
									className="auth-link"
									onClick={() => {
										setAuthMode('login');
										setResetStep(1);
										setAuthError('');
									}}
								>
									Back to Sign In
								</span>
							</div>
						</>
					)}
				</div>

				{/* Toast notifications */}
				<div className="toast-container">
					{toasts.map(toast => (
						<div key={toast.id} className={`toast ${toast.type}`}>
							{toast.message}
						</div>
					))}
				</div>
			</div>
		);
	}

	// Render Dashboard
	return (
		<div className="app-container">
			{/* 1. Sidebar Panel */}
			<div className="sidebar-panel">
				{/* Brand Branding Logo */}
				<div className="brand-container">
					<div className="brand-details">
						<span className="brand-name">Solance</span>
						<span className="brand-subtitle">Your Daily Sanctuary</span>
					</div>
				</div>

				<button className="btn-new-entry" onClick={handleNewEntry}>
					{icons.add} New Entry
				</button>

				<nav className="nav-menu">
					<div
						className={`nav-item ${currentView === 'Timeline' ? 'active' : ''}`}
						onClick={() => setCurrentView('Timeline')}
					>
						{icons.timeline} Timeline
					</div>
					<div
						className={`nav-item ${currentView === 'Calendar' ? 'active' : ''}`}
						onClick={() => setCurrentView('Calendar')}
					>
						{icons.calendar} Calendar
					</div>
					<div
						className={`nav-item ${currentView === 'Insights' ? 'active' : ''}`}
						onClick={() => setCurrentView('Insights')}
					>
						{icons.insights} Insights
					</div>
					<div
						className={`nav-item ${currentView === 'Settings' ? 'active' : ''}`}
						onClick={() => setCurrentView('Settings')}
					>
						{icons.settings} Settings
					</div>
				</nav>

				<div className="recent-header">Recent Entries</div>

				{/* Dynamic Search Bar */}
				<div className="search-container" style={{ margin: '8px 0 16px 0' }}>
					<input
						type="text"
						className="search-input"
						placeholder="Search entries..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
					<svg className="search-icon" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 1 5.196 5.196a7.5 7.5 0 0 1 10.637 10.637Z" />
					</svg>
				</div>

				<div className="recent-list" onScroll={handleSidebarScroll}>
					{filteredEntries.length === 0 ? (
						<div className="recent-empty">
							{searchQuery ? 'No matching entries found.' : 'No entries yet. Write your first diary notes!'}
						</div>
					) : (
						<>
							{filteredEntries.map(entry => (
								<div
									key={entry._id}
									className={`recent-item ${selectedEntry?._id === entry._id ? 'selected' : ''}`}
									onClick={() => handleSelectEntry(entry)}
								>
									<span className="recent-date">{formatSidebarDate(entry.createdAt)}</span>
									<span className="recent-title-snippet">{entry.title || 'Untitled Entry'}</span>
									<button
										className="recent-delete-btn"
										title="Delete Entry"
										onClick={(e) => {
											e.stopPropagation();
											handleDelete(entry._id);
										}}
									>
										<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
											<path d="M0 0h24v24H0z" fill="none" />
											<path fill="currentColor" d="M20.725 5.275h-4.69v-.89a2.4 2.4 0 0 0-.7-1.68a2.38 2.38 0 0 0-1.69-.7h-3.26a2.38 2.38 0 0 0-1.69.7a2.4 2.4 0 0 0-.69 1.68v.89h-4.69a.75.75 0 1 0 0 1.5h1.42v11.76a3.45 3.45 0 0 0 1 2.46a3.5 3.5 0 0 0 2.45 1h7.62a3.5 3.5 0 0 0 2.45-1a3.45 3.45 0 0 0 1-2.46V6.775h1.43a.75.75 0 0 0 0-1.5zm-11.2-.89a.87.87 0 0 1 .26-.62a.9.9 0 0 1 .62-.26h3.26a.88.88 0 0 1 .63.26a.9.9 0 0 1 .26.62v.89h-5zm1.33 12.61a1 1 0 1 1-2 0v-5.43a1 1 0 0 1 2 0zm4.36 0a1 1 0 0 1-2 0v-5.43a1 1 0 0 1 2 0z" />
										</svg>

									</button>
									<div>
										<span className="recent-snippet">{entry.notes}</span>
									</div>
								</div>
							))}
							{isLoadingMore && (
								<div className="recent-loading-more" style={{ padding: '10px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
									Loading more...
								</div>
							)}
						</>
					)}
				</div>

				<div className="sidebar-footer">
					<div className="user-badge">
						<div className="user-avatar">
							{user?.userName ? user.userName.substring(0, 2).toUpperCase() : 'U'}
						</div>
						<div className="user-info">
							<span className="user-name" title={user?.userName }>{user?.userName}</span>
						</div>
					</div>
					<button className="btn-logout" title="Sign Out" onClick={handleLogout}>
						{icons.logout}
					</button>
				</div>
			</div>

			{/* 2. Main Editor Panel */}
			<div className="editor-panel">
				{currentView === 'Timeline' && (
					<div className="editor-content-wrapper">
						<div className="editor-header">
							<div className="editor-date-input">
								{formatDatePretty(editorDate)}
							</div>

							<div className="editor-meta">
								<div className="mood-selector">
									<span className="mood-label">Mood:</span>
									<button
										type="button"
										className={`mood-btn ${editorMood === 'plane' ? 'active' : ''}`}
										onClick={() => setEditorMood('plane')}
										title="Travel/Adventurous"
									>
										✈️
									</button>
									<button
										type="button"
										className={`mood-btn ${editorMood === 'smiley' ? 'active' : ''}`}
										onClick={() => setEditorMood('smiley')}
										title="Happy/Peaceful"
									>
										😊
									</button>
									<button
										type="button"
										className={`mood-btn ${editorMood === 'cog' ? 'active' : ''}`}
										onClick={() => setEditorMood('cog')}
										title="Reflective/Focused"
									>
										⚙️
									</button>
									<button
										type="button"
										className={`mood-btn ${editorMood === 'moon' ? 'active' : ''}`}
										onClick={() => setEditorMood('moon')}
										title="Quiet/Sleepy"
									>
										🌙
									</button>
								</div>

								<div className="badges-wrapper">
									{/* Real-time Word Counter Badge */}
									<div className="word-count-badge" title="Word count of your entry">
										<span style={{ fontSize: '0.85rem' }}>✍️</span> {getWordCount(editorNotes)} {getWordCount(editorNotes) === 1 ? 'word' : 'words'}
									</div>
								</div>
							</div>
						</div>

						<div className="editor-body">
							<input
								type="text"
								className="editor-title-field"
								placeholder="Give your entry a title..."
								value={editorTitle}
								onChange={(e) => setEditorTitle(e.target.value)}
							/>
							<textarea
								className="editor-textarea"
								required
								placeholder="Write about your day, thoughts, feelings..."
								value={editorNotes}
								onChange={(e) => setEditorNotes(e.target.value)}
							/>
						</div>

						<div className="editor-footer">
							<button
								className="btn-save-entry"
								onClick={handleSaveEntry}
								disabled={isSaving}
							>
								{icons.save} {isSaving ? 'Saving...' : 'Save Entry'}
							</button>
						</div>
					</div>
				)}

				{currentView === 'Calendar' && (
					<div className="fallback-view">
						<h2 className="fallback-title">Calendar Archive</h2>
						<p className="fallback-text">
							Track and select your entries historically. You have written <strong>{totalEntriesCount} entries</strong>.
							Use the sidebar calendar grid on the right to navigate dates and filter entries by day.
						</p>
						<div className="recent-list" style={{ width: '100%', marginTop: '20px' }}>
							{entries.map(entry => (
								<div
									key={entry._id}
									className="recent-item"
									style={{ backgroundColor: 'var(--bg-card)', padding: '16px', border: '1px solid var(--border-light)' }}
									onClick={() => handleSelectEntry(entry)}
								>
									<span className="recent-date">{formatDatePretty(entry.createdAt)}</span>
									<span className="recent-title-snippet" style={{ fontSize: '1.05rem', margin: '4px 0' }}>{entry.title || 'Untitled'}</span>
									<span className="recent-snippet" style={{ WebkitLineClamp: 3 }}>{entry.notes}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{currentView === 'Insights' && (
					<div className="fallback-view">
						<h2 className="fallback-title">Sanctuary Insights</h2>
						<p className="fallback-text">
							Understand your mental health rhythms, track emotional milestones, and see your writing streak.
						</p>
						<div className="insights-grid">
							<div className="insights-card">
								<div className="insights-card-title">Total Entries</div>
								<div className="insights-card-value">{totalEntriesCount}</div>
							</div>
							<div className="insights-card">
								<div className="insights-card-title">Writing Streak</div>
								<div className="insights-card-value">
									{totalEntriesCount > 0 ? `${Math.min(totalEntriesCount, 5)} Days` : '0 Days'}
								</div>
							</div>
							<div className="insights-card">
								<div className="insights-card-title">Dominant Mood</div>
								<div className="insights-card-value">
									{entries.some(e => e.mood === 'smiley') ? '😊 Happy' : '⚙️ Focus'}
								</div>
							</div>
							<div className="insights-card">
								<div className="insights-card-title">Sanctuary Level</div>
								<div className="insights-card-value">Level {Math.floor(totalEntriesCount / 5) + 1}</div>
							</div>
						</div>
					</div>
				)}

				{currentView === 'Settings' && (
					<div className="fallback-view">
						<h2 className="fallback-title">Sanctuary Settings</h2>
						<p className="fallback-text">Customize your writing environment, secure database backups, and manage your account.</p>
						<div className="settings-group">
							<div className="settings-item">
								<span className="settings-item-label">Dark Sanctuary Mode</span>
								<span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Follows System Preference</span>
							</div>
							<div className="settings-item">
								<span className="settings-item-label">Daily Reminder Notifications</span>
								<span style={{ color: 'var(--accent-green)', fontWeight: '600', fontSize: '0.85rem' }}>Active</span>
							</div>
							<div className="settings-item">
								<span className="settings-item-label">Secure Data Export (JSON)</span>
								<button
									className="auth-btn"
									style={{ margin: 0, padding: '6px 12px', fontSize: '0.8rem' }}
									onClick={() => {
										const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
										const downloadAnchor = document.createElement('a');
										downloadAnchor.setAttribute("href", dataStr);
										downloadAnchor.setAttribute("download", "solance_diary_backup.json");
										downloadAnchor.click();
										addToast("Export started!");
									}}
								>
									Export
								</button>
							</div>
							<div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
								<span className="settings-item-label">Change Password</span>
								<span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Securely update your sanctuary account password.</span>
								<form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '360px', marginTop: '12px' }}>
									<div className="form-group" style={{ margin: 0 }}>
										<label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block' }}>Current Password</label>
										<input
											type="password"
											className="input-field"
											placeholder="••••••••"
											value={passwordForm.existingPassword}
											onChange={(e) => setPasswordForm({ ...passwordForm, existingPassword: e.target.value })}
											style={{ marginTop: '4px' }}
											required
										/>
									</div>
									<div className="form-group" style={{ margin: 0 }}>
										<label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block' }}>New Password</label>
										<input
											type="password"
											className="input-field"
											placeholder="••••••••"
											value={passwordForm.newPassword}
											onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
											style={{ marginTop: '4px' }}
											required
										/>
									</div>
									<div className="form-group" style={{ margin: 0 }}>
										<label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block' }}>Confirm New Password</label>
										<input
											type="password"
											className="input-field"
											placeholder="••••••••"
											value={passwordForm.confirmPassword}
											onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
											style={{ marginTop: '4px' }}
											required
										/>
									</div>
									<button type="submit" className="auth-btn" style={{ margin: '8px 0 0 0', padding: '10px' }} disabled={isChangingPassword}>
										{isChangingPassword ? 'Updating Password...' : 'Update Password'}
									</button>
								</form>
							</div>

							<div className="settings-item" style={{ borderLeft: '3px solid #c53030' }}>
								<span className="settings-item-label" style={{ color: '#c53030' }}>Sign Out Account</span>
								<button
									className="auth-btn"
									style={{ margin: 0, padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#c53030' }}
									onClick={handleLogout}
								>
									Logout
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* 3. Right Widgets Panel */}
			<div className="widgets-panel">
				{/* Calendar Card */}
				<div className="widget-card">
					<div className="calendar-header">
						<span className="calendar-title">
							{currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
						</span>
						<div className="calendar-arrows">
							<button className="arrow-btn" onClick={() => changeMonth(-1)}>
								&lt;
							</button>
							<button className="arrow-btn" onClick={() => changeMonth(1)}>
								&gt;
							</button>
						</div>
					</div>

					<div className="calendar-grid">
						{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
							<div key={index} className="calendar-day-label">{d}</div>
						))}

						{getDaysInMonth(currentCalendarDate).map((day, index) => {
							if (day.type === 'empty') {
								return <div key={index} className="calendar-cell empty"></div>;
							}

							const isSelected = selectedEntry && selectedEntry.createdAt && selectedEntry.createdAt.split('T')[0] === day.dateString;
							const classes = [
								'calendar-cell',
								day.isToday ? 'today' : '',
								day.hasEntry ? 'has-entry' : '',
								isSelected ? 'selected' : ''
							].filter(Boolean).join(' ');

							return (
								<div
									key={index}
									className={classes}
									onClick={() => handleCalendarDayClick(day)}
									title={day.hasEntry ? `${day.entries.length} entry/entries` : 'Write new entry on this date'}
								>
									{day.dayNumber}
								</div>
							);
						})}
					</div>
				</div>

				{/* Memory "One Year Ago" Card */}
				<div className="memory-card">
					<div className="memory-header">
						<div className="memory-title-wrapper">
							<span className="memory-title">
								<svg className="memory-icon" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
								</svg>
								One Year Ago
							</span>
							<span className="memory-date">{memory.date}</span>
						</div>

						<svg className="memory-illustration" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6c0-3.313-2.687-6-6-6s-6 2.687-6 6c0 3.313 2.687 6 6 6Z" />
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
							<path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75h3M4.5 12.75h3" />
						</svg>
					</div>

					<div style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
						{memory.title}
					</div>

					<p className="memory-quote">
						"{memory.notes.substring(0, 140)}..."
					</p>
				</div>
			</div>

			{/* Toast notifications */}
			<div className="toast-container">
				{toasts.map(toast => (
					<div key={toast.id} className={`toast ${toast.type}`}>
						{toast.message}
					</div>
				))}
			</div>
		</div>
	);
}

export default App;
