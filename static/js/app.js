// ============================================
// MODERN CONTRACT PROCESSING PLATFORM APP
// ============================================

class ContractApp {
    constructor() {
        this.currentContractId = null;
        this.currentExtracted = null;
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    init() {
        this.checkSession();
        this.setupNavigation();
        this.setupPageSpecificListeners();
    }

    /* ============================================
       SESSION MANAGEMENT
       ============================================ */

    async checkSession() {
        try {
            const response = await fetch('/api/auth/session');
            const data = await response.json();

            if (data.authenticated) {
                this.showApp();
                if (this.currentPage === 'dashboard') {
                    this.loadDashboardStats();
                    this.loadRecentContracts();
                }
                if (this.currentPage === 'contracts') {
                    this.loadContracts();
                }
            } else {
                this.showAuth();
            }
        } catch (error) {
            console.error('Session check failed:', error);
            this.showAuth();
        }
    }

    async handleLogin() {
        const pin = document.getElementById('pin').value;
        const errorDiv = document.getElementById('authError');
        errorDiv.style.display = 'none';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });

            const data = await response.json();

            if (data.success) {
                this.showApp();
                window.location.href = '/';
            } else {
                errorDiv.textContent = data.error || 'Invalid PIN';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            errorDiv.textContent = 'Login failed. Please try again.';
            errorDiv.style.display = 'block';
        }
    }

    async handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            this.showAuth();
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    /* ============================================
       NAVIGATION
       ============================================ */

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const path = item.getAttribute('href');
            if (window.location.pathname === path || 
                (window.location.pathname === '/' && path === '/')) {
                item.classList.add('active');
            }
            
            item.addEventListener('click', (e) => {
                // Let default link behavior work
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });

        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Mobile sidebar toggle
        const sidebarToggle = document.getElementById('toggleSidebar');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                const sidebar = document.querySelector('.sidebar');
                sidebar.classList.toggle('active');
            });
        }
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/') return 'dashboard';
        if (path.includes('/upload')) return 'upload';
        if (path.includes('/contracts')) return 'contracts';
        if (path.includes('/settings')) return 'settings';
        return 'dashboard';
    }

    /* ============================================
       UI STATE MANAGEMENT
       ============================================ */

    showApp() {
        const modal = document.getElementById('authModal');
        if (modal) modal.style.display = 'none';
        const userInfo = document.getElementById('userInfo');
        if (userInfo) userInfo.style.display = 'flex';
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.style.display = 'flex';
    }

    showAuth() {
        const modal = document.getElementById('authModal');
        if (modal) modal.style.display = 'flex';
        const userInfo = document.getElementById('userInfo');
        if (userInfo) userInfo.style.display = 'none';
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.style.display = 'none';
    }

    /* ============================================
       DASHBOARD
       ============================================ */

    async loadDashboardStats() {
        try {
            const response = await fetch('/api/contracts/history');
            const data = await response.json();
            
            if (data.contracts) {
                const total = data.contracts.length;
                const extracted = data.contracts.filter(c => c.status === 'extracted').length;
                const confirmed = data.contracts.filter(c => c.status === 'confirmed').length;
                const rate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

                const totalEl = document.getElementById('totalContracts');
                const extractedEl = document.getElementById('extractedCount');
                const confirmedEl = document.getElementById('confirmedCount');
                const rateEl = document.getElementById('successRate');

                if (totalEl) totalEl.textContent = total;
                if (extractedEl) extractedEl.textContent = extracted;
                if (confirmedEl) confirmedEl.textContent = confirmed;
                if (rateEl) rateEl.textContent = rate + '%';
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async loadRecentContracts() {
        try {
            const response = await fetch('/api/contracts/history');
            const data = await response.json();
            
            const list = document.getElementById('recentContractsList');
            if (!list) return;

            if (data.contracts && data.contracts.length > 0) {
                const recent = data.contracts.slice(0, 5);
                list.innerHTML = recent.map(contract => `
                    <div class="contract-item-compact">
                        <div class="contract-item-main">
                            <div class="contract-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                </svg>
                            </div>
                            <div class="contract-item-info">
                                <p class="contract-item-name">${contract.filename}</p>
                                <p class="contract-item-date">${new Date(contract.timestamp).toLocaleDateString()}</p>
                            </div>
                            <span class="status-badge ${contract.status}">${contract.status}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                list.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        </svg>
                        <p>No contracts yet. <a href="/upload">Upload one to get started</a></p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load recent contracts:', error);
        }
    }

    /* ============================================
       UPLOAD / EXTRACT
       ============================================ */

    setupPageSpecificListeners() {
        if (this.currentPage === 'upload') {
            this.setupUploadListeners();
        } else if (this.currentPage === 'contracts') {
            this.setupContractsListeners();
        } else if (this.currentPage === 'settings') {
            this.setupSettingsListeners();
        }
    }

    setupUploadListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    fileInput.files = files;
                    this.handleFileSelect();
                }
            });

            fileInput.addEventListener('change', () => this.handleFileSelect());
        }

        const extractBtn = document.getElementById('extractBtn');
        if (extractBtn) extractBtn.addEventListener('click', () => this.handleExtract());

        const formViewBtn = document.getElementById('formViewBtn');
        const jsonViewBtn = document.getElementById('jsonViewBtn');
        if (formViewBtn) formViewBtn.addEventListener('click', () => this.switchView('form'));
        if (jsonViewBtn) jsonViewBtn.addEventListener('click', () => this.switchView('json'));

        const confirmBtn = document.getElementById('confirmBtn');
        const resetBtn = document.getElementById('resetBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        if (confirmBtn) confirmBtn.addEventListener('click', () => this.handleConfirm());
        if (resetBtn) resetBtn.addEventListener('click', () => this.handleReset());
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.handleDelete());

        const removeFileBtn = document.getElementById('removeFileBtn');
        if (removeFileBtn) {
            removeFileBtn.addEventListener('click', () => {
                const fileInput = document.getElementById('fileInput');
                fileInput.value = '';
                this.handleFileSelect();
            });
        }

        // PIN Authentication Modal Handler
        const pinAuthForm = document.getElementById('pinAuthForm');
        if (pinAuthForm) {
            pinAuthForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const pin = document.getElementById('confirmPin').value;
                const pinError = document.getElementById('pinError');
                
                if (!pin || pin.length === 0) {
                    pinError.textContent = 'PIN is required';
                    pinError.style.display = 'block';
                    return;
                }
                
                pinError.style.display = 'none';
                this.verifyPinAndConfirm(pin);
            });
        }

        // Retry Button Handler for Failed Result
        const retryPinBtn = document.getElementById('retryPinBtn');
        if (retryPinBtn) {
            retryPinBtn.addEventListener('click', () => {
                // Show form/json views and hide result
                const formView = document.getElementById('formView');
                const jsonView = document.getElementById('jsonView');
                const resultContainer = document.getElementById('resultContainer');
                const confirmBtn = document.getElementById('confirmBtn');
                
                if (formView) formView.style.display = 'block';
                if (jsonView && !document.getElementById('jsonViewBtn').classList.contains('active')) jsonView.style.display = 'none';
                if (resultContainer) resultContainer.style.display = 'none';
                if (confirmBtn) confirmBtn.style.display = 'block';

                // Clear and show PIN modal for retry
                const confirmPin = document.getElementById('confirmPin');
                const pinError = document.getElementById('pinError');
                const pinAuthModal = document.getElementById('pinAuthModal');
                if (confirmPin) confirmPin.value = '';
                if (pinError) pinError.style.display = 'none';
                if (pinAuthModal) pinAuthModal.style.display = 'flex';
            });
        }

        // Start Over Button Handler for Success Result
        const successStartOverBtn = document.getElementById('successStartOverBtn');
        if (successStartOverBtn) {
            successStartOverBtn.addEventListener('click', () => {
                this.handleReset();
            });
        }

        // Start Over Button Handler for Failure Result
        const failureStartOverBtn = document.getElementById('failureStartOverBtn');
        if (failureStartOverBtn) {
            failureStartOverBtn.addEventListener('click', () => {
                this.handleReset();
            });
        }
    }

    handleFileSelect() {
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const extractBtn = document.getElementById('extractBtn');

        if (!fileInput || !fileInfo || !extractBtn) return;

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileSize').textContent = `${sizeMB} MB`;
            fileInfo.style.display = 'block';
            extractBtn.disabled = false;
        } else {
            fileInfo.style.display = 'none';
            extractBtn.disabled = true;
        }
    }

    async handleExtract() {
        const fileInput = document.getElementById('fileInput');
        const extractBtn = document.getElementById('extractBtn');
        const extractBtnText = document.getElementById('extractBtnText');
        const extractLoader = document.getElementById('extractLoader');
        const uploadStatus = document.getElementById('uploadStatus');

        const file = fileInput?.files[0];
        if (!file) return;

        if (extractBtn) extractBtn.disabled = true;
        if (extractBtnText) extractBtnText.style.display = 'none';
        if (extractLoader) extractLoader.style.display = 'inline-block';
        if (uploadStatus) uploadStatus.textContent = 'Extracting contract data...';
        if (uploadStatus) uploadStatus.className = 'status-message';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/contracts/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.currentContractId = data.contract_id;
                this.currentExtracted = data.extracted;

                this.renderFormView(data.extracted);
                const jsonEditor = document.getElementById('jsonEditor');
                if (jsonEditor) jsonEditor.value = JSON.stringify(data.extracted, null, 2);

                const confirmBtn = document.getElementById('confirmBtn');
                const resetBtn = document.getElementById('resetBtn');
                const deleteBtn = document.getElementById('deleteBtn');
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.style.display = 'block';
                }
                if (resetBtn) resetBtn.disabled = false;
                if (deleteBtn) deleteBtn.style.display = 'block';

                if (uploadStatus) uploadStatus.textContent = `✓ Extraction complete! Review the data below.`;
                if (uploadStatus) uploadStatus.className = 'status-message success-message';

                this.updateUploadProgress(3);

                const uploadSection = document.getElementById('uploadSection');
                const reviewSection = document.getElementById('reviewSection');
                if (uploadSection) uploadSection.style.display = 'none';
                if (reviewSection) reviewSection.style.display = 'block';
            } else {
                throw new Error(data.error || 'Extraction failed');
            }
        } catch (error) {
            if (uploadStatus) uploadStatus.textContent = `✗ ${error.message}`;
            if (uploadStatus) uploadStatus.className = 'status-message error-message';
        } finally {
            if (extractBtn) extractBtn.disabled = false;
            if (extractBtnText) extractBtnText.style.display = 'inline';
            if (extractLoader) extractLoader.style.display = 'none';
        }
    }

    renderFormView(data) {
        const form = document.getElementById('extractedForm');
        if (!form) return;

        const fields = [
            { label: 'Customer Name', key: 'customer_name' },
            { label: 'Customer Email', key: 'customer_email' },
            { label: 'Customer Phone', key: 'customer_phone' },
            { label: 'Plan ID', key: 'plan_id' },
            { label: 'Item Price ID', key: 'item_price_id' },
            { label: 'Start Date', key: 'start_date' },
            { label: 'Term (months)', key: 'term_months' },
            { label: 'Base Price/Month', key: 'base_price_per_month' },
            { label: 'Tax %', key: 'tax_percent' },
            { label: 'Currency', key: 'currency' },
            { label: 'PO Number', key: 'po_number' },
            { label: 'Payment Terms', key: 'payment_terms' },
        ];

        let html = '';

        fields.forEach(field => {
            const value = data[field.key] || '';
            html += `
                <div class="form-group">
                    <label>${field.label}</label>
                    <input 
                        type="text" 
                        class="form-input" 
                        data-key="${field.key}"
                        value="${value}"
                        onchange="app.updateField('${field.key}', this.value)"
                    />
                </div>
            `;
        });

        if (data.ramp && data.ramp.length > 0) {
            html += '<h4 style="margin-top: 1.5rem; margin-bottom: 0.75rem; grid-column: 1/-1; color: var(--text-primary);">Ramp Schedule</h4>';
            data.ramp.forEach((phase, i) => {
                html += `
                    <div style="background: rgba(15, 23, 42, 0.5); padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; grid-column: 1/-1; border: 1px solid rgba(255, 255, 255, 0.1);">
                        <strong style="color: var(--primary);">Phase ${i + 1}:</strong> 
                        <span style="color: var(--text-secondary);">
                            Months ${phase.start_month}-${phase.end_month}: 
                            ${phase.price_per_month || 'N/A'}
                            ${phase.discount_percent ? `(${phase.discount_percent}% discount)` : ''}
                            ${phase.notes ? `- ${phase.notes}` : ''}
                        </span>
                    </div>
                `;
            });
        }

        form.innerHTML = html;
    }

    updateField(key, value) {
        if (this.currentExtracted) {
            this.currentExtracted[key] = value;
            const jsonEditor = document.getElementById('jsonEditor');
            if (jsonEditor) jsonEditor.value = JSON.stringify(this.currentExtracted, null, 2);
        }
    }

    switchView(view) {
        const formView = document.getElementById('formView');
        const jsonView = document.getElementById('jsonView');
        const formBtn = document.getElementById('formViewBtn');
        const jsonBtn = document.getElementById('jsonViewBtn');

        if (view === 'form') {
            if (formView) formView.style.display = 'block';
            if (jsonView) jsonView.style.display = 'none';
            if (formBtn) formBtn.classList.add('active');
            if (jsonBtn) jsonBtn.classList.remove('active');
        } else {
            if (formView) formView.style.display = 'none';
            if (jsonView) jsonView.style.display = 'block';
            if (formBtn) formBtn.classList.remove('active');
            if (jsonBtn) jsonBtn.classList.add('active');

            try {
                const jsonEditor = document.getElementById('jsonEditor');
                if (jsonEditor) {
                    const jsonData = JSON.parse(jsonEditor.value);
                    this.currentExtracted = jsonData;
                }
            } catch (e) {
                // Invalid JSON, keep current
            }
        }
    }

    async handleConfirm() {
        // Show PIN authentication modal
        const pinAuthModal = document.getElementById('pinAuthModal');
        const confirmPin = document.getElementById('confirmPin');
        const pinError = document.getElementById('pinError');
        
        if (pinAuthModal) {
            pinAuthModal.style.display = 'flex';
            confirmPin.value = '';
            pinError.style.display = 'none';
            confirmPin.focus();
        }
    }

    async verifyPinAndConfirm(pin) {
        const confirmBtn = document.getElementById('confirmBtn');
        const confirmBtnText = document.getElementById('confirmBtnText');
        const confirmLoader = document.getElementById('confirmLoader');
        const jsonEditor = document.getElementById('jsonEditor');
        const pinError = document.getElementById('pinError');

        try {
            if (jsonEditor) {
                this.currentExtracted = JSON.parse(jsonEditor.value);
            }
        } catch (e) {
            pinError.textContent = '✗ Invalid JSON. Please fix the format.';
            pinError.style.display = 'block';
            return;
        }

        if (confirmBtn) confirmBtn.disabled = true;
        if (confirmBtnText) confirmBtnText.style.display = 'none';
        if (confirmLoader) confirmLoader.style.display = 'inline-block';
        pinError.style.display = 'none';

        try {
            const response = await fetch('/api/contracts/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: this.currentContractId,
                    extracted: this.currentExtracted,
                    pin: pin
                })
            });

            const data = await response.json();

            if (data.success) {
                // Close PIN modal
                const pinAuthModal = document.getElementById('pinAuthModal');
                if (pinAuthModal) pinAuthModal.style.display = 'none';

                // Hide form/json view and show result inline
                const formView = document.getElementById('formView');
                const jsonView = document.getElementById('jsonView');
                const resultContainer = document.getElementById('resultContainer');
                const confirmBtn = document.getElementById('confirmBtn');
                
                if (formView) formView.style.display = 'none';
                if (jsonView) jsonView.style.display = 'none';
                if (resultContainer) resultContainer.style.display = 'block';
                if (confirmBtn) confirmBtn.style.display = 'none';

                // Show success result
                const successResult = document.getElementById('successResult');
                const failureResult = document.getElementById('failureResult');
                if (successResult) successResult.style.display = 'block';
                if (failureResult) failureResult.style.display = 'none';

                // Update subscription ID if available
                if (data.chargebee.subscription_id) {
                    const subIdEl = document.getElementById('successSubId');
                    if (subIdEl) subIdEl.textContent = `Subscription ID: ${data.chargebee.subscription_id}`;
                }
            } else {
                throw new Error(data.error || 'Confirmation failed');
            }
        } catch (error) {
            // Close PIN modal
            const pinAuthModal = document.getElementById('pinAuthModal');
            if (pinAuthModal) pinAuthModal.style.display = 'none';

            // Hide form/json view and show result inline
            const formView = document.getElementById('formView');
            const jsonView = document.getElementById('jsonView');
            const resultContainer = document.getElementById('resultContainer');
            const confirmBtn = document.getElementById('confirmBtn');
            
            if (formView) formView.style.display = 'none';
            if (jsonView) jsonView.style.display = 'none';
            if (resultContainer) resultContainer.style.display = 'block';
            if (confirmBtn) confirmBtn.style.display = 'none';

            // Show failure result
            const failureResult = document.getElementById('failureResult');
            const successResult = document.getElementById('successResult');
            if (failureResult) failureResult.style.display = 'block';
            if (successResult) successResult.style.display = 'none';

            // Update error message
            const failureMessage = document.getElementById('failureMessage');
            if (failureMessage) failureMessage.textContent = error.message;
        } finally {
            if (confirmBtn) confirmBtn.disabled = false;
            if (confirmBtnText) confirmBtnText.style.display = 'inline';
            if (confirmLoader) confirmLoader.style.display = 'none';
        }
    }

    handleReset() {
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const extractBtn = document.getElementById('extractBtn');
        const uploadStatus = document.getElementById('uploadStatus');

        if (fileInput) fileInput.value = '';
        if (fileInfo) fileInfo.style.display = 'none';
        if (extractBtn) extractBtn.disabled = true;
        if (uploadStatus) uploadStatus.textContent = '';

        const extractedForm = document.getElementById('extractedForm');
        const jsonEditor = document.getElementById('jsonEditor');
        if (extractedForm) extractedForm.innerHTML = '';
        if (jsonEditor) jsonEditor.value = '';

        const confirmBtn = document.getElementById('confirmBtn');
        const resetBtn = document.getElementById('resetBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const confirmStatus = document.getElementById('confirmStatus');
        const resultContainer = document.getElementById('resultContainer');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.style.display = 'none';
        }
        if (resetBtn) resetBtn.disabled = true;
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (confirmStatus) confirmStatus.textContent = '';
        if (resultContainer) resultContainer.style.display = 'none';

        const uploadSection = document.getElementById('uploadSection');
        const reviewSection = document.getElementById('reviewSection');
        if (uploadSection) uploadSection.style.display = 'block';
        if (reviewSection) reviewSection.style.display = 'none';

        this.currentContractId = null;
        this.currentExtracted = null;
        this.updateUploadProgress(1);
    }

    updateUploadProgress(step) {
        for (let i = 1; i <= 3; i++) {
            const stepEl = document.getElementById(`step${i}`);
            if (stepEl) {
                if (i <= step) {
                    stepEl.classList.add('active');
                } else {
                    stepEl.classList.remove('active');
                }
            }
        }
    }

    handleDelete() {
        // Show confirmation dialog
        if (!confirm('Are you sure you want to delete all files? This action cannot be undone.')) {
            return;
        }

        // Call backend delete API
        fetch('/api/contracts/delete', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                alert('All files deleted successfully');
                // Reset UI to initial state
                this.handleReset();
            } else {
                alert('Error deleting files: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Delete error:', error);
            alert('Error deleting files: ' + error.message);
        });
    }

    /* ============================================
       CONTRACTS LIST
       ============================================ */

    setupContractsListeners() {
        this.loadContracts();
        
        const searchInput = document.getElementById('searchInput');
        const statusFilter = document.getElementById('statusFilter');
        const refreshBtn = document.getElementById('refreshBtn');

        if (searchInput) searchInput.addEventListener('input', () => this.filterContracts());
        if (statusFilter) statusFilter.addEventListener('change', () => this.filterContracts());
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadContracts());
    }

    async loadContracts() {
        try {
            const response = await fetch('/api/contracts/history');
            const data = await response.json();

            const tableBody = document.getElementById('contractsTableBody');
            const gridView = document.getElementById('gridView');
            const emptyState = document.getElementById('emptyState');

            if (!tableBody && !gridView) return;

            if (data.contracts && data.contracts.length > 0) {
                if (emptyState) emptyState.style.display = 'none';

                if (tableBody) {
                    tableBody.innerHTML = data.contracts.map(contract => `
                        <tr>
                            <td><strong>${contract.filename}</strong></td>
                            <td>${new Date(contract.timestamp).toLocaleString()}</td>
                            <td>
                                <span class="status-badge ${contract.status}">${contract.status}</span>
                            </td>
                            <td>
                                <button class="btn-sm" onclick="app.loadContractDetail('${contract.contract_id}')">View</button>
                            </td>
                        </tr>
                    `).join('');
                }

                if (gridView) {
                    gridView.innerHTML = data.contracts.map(contract => `
                        <div class="contract-card">
                            <div class="contract-card-header">
                                <div class="contract-card-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    </svg>
                                </div>
                                <div class="contract-card-title">
                                    <h3>${contract.filename}</h3>
                                    <p>${new Date(contract.timestamp).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div class="contract-card-meta">
                                <span class="card-date">${new Date(contract.timestamp).toLocaleTimeString()}</span>
                                <span class="status-badge ${contract.status}">${contract.status}</span>
                            </div>
                        </div>
                    `).join('');
                }
            } else {
                if (emptyState) emptyState.style.display = 'block';
                if (tableBody) tableBody.innerHTML = '';
                if (gridView) gridView.innerHTML = '';
            }
        } catch (error) {
            console.error('Failed to load contracts:', error);
        }
    }

    async loadContractDetail(contractId) {
        try {
            const response = await fetch(`/api/contracts/${contractId}`);
            const data = await response.json();

            if (data.extracted) {
                alert('Contract: ' + JSON.stringify(data.extracted, null, 2));
            }
        } catch (error) {
            console.error('Failed to load contract:', error);
        }
    }

    filterContracts() {
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        const statusTerm = document.getElementById('statusFilter')?.value || '';
        
        const rows = document.querySelectorAll('#contractsTableBody tr');
        const cards = document.querySelectorAll('.contract-card');

        rows.forEach(row => {
            const filename = row.cells[0]?.textContent.toLowerCase() || '';
            const status = row.cells[2]?.textContent.toLowerCase() || '';
            const matches = filename.includes(searchTerm) && (!statusTerm || status.includes(statusTerm));
            row.style.display = matches ? '' : 'none';
        });

        cards.forEach(card => {
            const filename = card.querySelector('h3')?.textContent.toLowerCase() || '';
            const badge = card.querySelector('.status-badge');
            const status = badge?.textContent.toLowerCase() || '';
            const matches = filename.includes(searchTerm) && (!statusTerm || status.includes(statusTerm));
            card.style.display = matches ? '' : 'none';
        });
    }

    setupSettingsListeners() {
        const settingsDeleteBtn = document.getElementById('settingsDeleteBtn');
        if (settingsDeleteBtn) {
            settingsDeleteBtn.addEventListener('click', () => this.handleDelete());
        }

        // Settings tabs functionality
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active from all buttons and tabs
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                // Add active to clicked button and corresponding tab
                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                const tabContent = document.getElementById(tabId);
                if (tabContent) tabContent.classList.add('active');
            });
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.app = new ContractApp();
});
