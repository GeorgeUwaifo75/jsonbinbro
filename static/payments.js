// static/payments.js - PayStack integration for JSONBinBro

class PaymentService {
    constructor() {
        this.publicKey = "pk_live_2018244c913523ab0751249b240bc3e3448c3c19";
        this.plans = null;
    }

    async loadPaymentPlans() {
        try {
            const response = await fetch('/api/payment-plans');
            if (response.ok) {
                this.plans = await response.json();
                return this.plans;
            }
        } catch (error) {
            console.error('Error loading payment plans:', error);
        }
        return null;
    }

    displayPaymentPlans(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !this.plans) return;

        container.innerHTML = `
            <div style="display: grid; gap: 15px;">
                ${Object.entries(this.plans).map(([level, plan]) => `
                    <div style="border: 2px solid #e0e0e0; border-radius: 10px; padding: 20px; transition: all 0.3s; cursor: pointer; background: white;" 
                         onmouseover="this.style.borderColor='#667eea'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.1)'" 
                         onmouseout="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="color: #667eea; margin: 0;">${plan.name}</h3>
                            <span style="background: #667eea; color: white; padding: 5px 10px; border-radius: 20px; font-size: 12px;">
                                <i class="fas fa-chart-line"></i> +${plan.requests.toLocaleString()} requests
                            </span>
                        </div>
                        <p style="font-size: 28px; font-weight: bold; color: #333; margin: 10px 0;">
                            ₦${plan.price_ngn.toLocaleString()}
                            <span style="font-size: 14px; font-weight: normal; color: #666;">NGN</span>
                        </p>
                        <p style="font-size: 12px; color: #999; margin-bottom: 20px;">≈ $${plan.price_usd} USD</p>
                        <button class="btn btn-primary" style="width: 100%;" 
                                onclick="paymentService.initiatePayment(${level}, '${plan.name}', ${plan.price_ngn}, ${plan.requests})">
                            <i class="fas fa-credit-card"></i> Pay with PayStack
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    initiatePayment(planLevel, planName, amount, requestsToAdd) {
        // Get current user info
        const userId = localStorage.getItem('userId');
        const userEmail = localStorage.getItem('userEmail') || '';
        const username = localStorage.getItem('username');
        
        if (!userId) {
            this.showStatus('Please login to make payment', 'error');
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
            return;
        }

        if (!userEmail) {
            this.showStatus('Please set your email in profile before making payment', 'error');
            setTimeout(() => {
                window.showProfile();
                this.closeModal();
            }, 2000);
            return;
        }

        // Generate unique reference
        const reference = `JSONBIN-${userId}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        
        // Store payment info temporarily
        sessionStorage.setItem('pendingPayment', JSON.stringify({
            planLevel,
            planName,
            amount,
            requestsToAdd,
            reference
        }));

        // Open PayStack popup
        const handler = PaystackPop.setup({
            key: this.publicKey,
            email: userEmail,
            amount: amount * 100, // Convert to kobo
            currency: 'NGN',
            ref: reference,
            metadata: {
                user_id: userId,
                username: username,
                plan_level: planLevel,
                plan_name: planName,
                custom_fields: [
                    {
                        display_name: "User ID",
                        variable_name: "user_id",
                        value: userId
                    },
                    {
                        display_name: "Plan",
                        variable_name: "plan",
                        value: planName
                    }
                ]
            },
            callback: (response) => {
                // Payment successful
                this.verifyAndConfirmPayment(response.reference, planLevel, planName, amount, requestsToAdd);
            },
            onClose: () => {
                // Payment cancelled
                this.showStatus('Payment cancelled', 'error');
                sessionStorage.removeItem('pendingPayment');
            }
        });
        
        handler.openIframe();
    }

    async verifyAndConfirmPayment(reference, planLevel, planName, amount, requestsToAdd) {
        this.showStatus('Verifying payment...', 'info');
        
        const userId = localStorage.getItem('userId');
        const apiKey = localStorage.getItem('apiKey');
        
        try {
            const response = await fetch('/api/confirm-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    api_key: apiKey,
                    payment_data: {
                        reference: reference,
                        plan_level: planLevel,
                        transaction_id: reference
                    }
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.showStatus(`✅ Payment successful! Added ${requestsToAdd.toLocaleString()} requests to your account!`, 'success');
                
                // Update local storage with new request limit
                const currentLimit = parseInt(localStorage.getItem('requestLimit') || '300');
                localStorage.setItem('requestLimit', currentLimit + requestsToAdd);
                
                // Refresh user data display
                if (window.refreshUserData) {
                    await window.refreshUserData();
                }
                
                // Show success message and close modal after delay
                setTimeout(() => {
                    this.closeModal();
                    if (window.showToastMessage) {
                        window.showToastMessage(`🎉 Success! Added ${requestsToAdd.toLocaleString()} requests to your account!`, 'success');
                    }
                }, 3000);
                
                sessionStorage.removeItem('pendingPayment');
            } else {
                const error = await response.json();
                this.showStatus(error.detail || 'Payment verification failed', 'error');
            }
        } catch (error) {
            console.error('Payment verification error:', error);
            this.showStatus('Network error. Please contact support.', 'error');
        }
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('paymentStatus');
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.className = type === 'error' ? 'error' : type === 'success' ? 'success' : 'loading';
            statusDiv.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-spinner fa-pulse'}"></i> ${message}`;
            
            setTimeout(() => {
                if (statusDiv.style.display !== 'none') {
                    statusDiv.style.opacity = '0.5';
                    setTimeout(() => {
                        statusDiv.style.display = 'none';
                        statusDiv.style.opacity = '1';
                    }, 2000);
                }
            }, 5000);
        }
    }

    closeModal() {
        const modal = document.getElementById('paymentModal');
        if (modal) modal.style.display = 'none';
        const statusDiv = document.getElementById('paymentStatus');
        if (statusDiv) statusDiv.style.display = 'none';
    }

    openModal() {
        const modal = document.getElementById('paymentModal');
        if (modal) modal.style.display = 'block';
    }
}

// Initialize payment service
const paymentService = new PaymentService();

// Modified showPayment function for the global scope
window.showPayment = async function() {
    await paymentService.loadPaymentPlans();
    paymentService.displayPaymentPlans('paymentPlansContainer');
    paymentService.openModal();
}

window.closePaymentModal = function() {
    paymentService.closeModal();
}

// Add function to update user email in profile (important for payments)
const originalUpdateProfile = window.updateProfile;
window.updateProfile = async function() {
    const email = document.getElementById('profileEmail')?.value;
    if (email) {
        localStorage.setItem('userEmail', email);
    }
    if (originalUpdateProfile) {
        await originalUpdateProfile();
    }
}

// Load user email on page load
document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail && userId) {
        // Prompt user to set email if not set
        setTimeout(() => {
            if (localStorage.getItem('userEmail') === null) {
                window.showToastMessage('Please update your email in Profile to enable payments', 'warning');
            }
        }, 2000);
    }
});