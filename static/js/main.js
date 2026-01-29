// Global variables
let holdings = [];
let editingId = null;
let confirmAction = null;

// Sorting state
let holdingsSort = { column: 'pct_change', direction: 'desc' }; // Default: %Chg descending
let wishlistSort = { column: 'signal', direction: 'desc' }; // Default: Signal descending (Buy > Hold > Sell)

// Update date and time
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    document.getElementById('datetime').textContent = now.toLocaleDateString('en-GB', options);
}

// Format date to dd/mm/yy
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
}

// Convert dd/mm/yy to yyyy-mm-dd for input fields
function convertDateForInput(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return `20${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

// Convert yyyy-mm-dd to dd/mm/yy for display
function convertDateFromInput(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parts[0].slice(-2);
        return `${parts[2]}/${parts[1]}/${year}`;
    }
    return dateStr;
}

// Format review factors with bold text
function formatReviewFactors(text) {
    if (!text) return '';
    // Convert **text** to <strong>text</strong>
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// Format currency
function formatCurrency(value) {
    if (value === null || value === undefined || value === '') return '-';
    return `$${parseFloat(value).toFixed(2)}`;
}

// Format number
function formatNumber(value) {
    if (value === null || value === undefined || value === '') return '-';
    return parseFloat(value).toFixed(2);
}

// Format percentage
function formatPercentage(value) {
    if (value === null || value === undefined || value === '') return '-';
    return `${parseFloat(value).toFixed(2)}%`;
}

// Get P/L class for conditional formatting
function getPLClass(value) {
    if (value === null || value === undefined || value === '' || value === 0) return 'neutral';
    return value > 0 ? 'positive' : 'negative';
}

// Format market cap
function formatMarketCap(value) {
    if (!value || value === 0) return 'N/A';
    
    if (value >= 1e12) {
        return `$${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
        return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
        return `$${(value / 1e6).toFixed(2)}M`;
    }
    return formatCurrency(value);
}

// Get signal icon - zig-zag arrows
function getSignalIcon(signal) {
    if (signal === 'Buy') {
        // Zig-zag arrow going up (bottom-left to top-right)
        return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:inline-block;vertical-align:middle;"><path d="M2 14L6 10L10 12L14 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2L11 2L11 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (signal === 'Sell') {
        // Zig-zag arrow going down (top-left to bottom-right)
        return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:inline-block;vertical-align:middle;"><path d="M2 2L6 6L10 4L14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 14L11 14L11 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    // Hold - horizontal line
    return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:inline-block;vertical-align:middle;"><path d="M2 8L14 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}

// Load holdings
async function loadHoldings() {
    try {
        const response = await fetch('/api/holdings');
        holdings = await response.json();
        renderHoldings();
    } catch (error) {
        console.error('Error loading holdings:', error);
        alert('Error loading holdings. Please refresh the page.');
    }
}

// Update portfolio summary
function updatePortfolioSummary() {
    if (holdings.length === 0) {
        document.getElementById('portfolioTotal').textContent = '$0.00';
        document.getElementById('portfolioPL').textContent = '$0.00 (0%)';
        document.getElementById('portfolioPL').className = 'portfolio-pl neutral';
        return;
    }
    
    let totalValue = 0;
    let totalPL = 0;
    let totalInvested = 0;
    
    holdings.forEach(holding => {
        totalValue += holding.value || 0;
        totalPL += holding.pl_dollar || 0;
        totalInvested += (holding.entry_price * holding.shares);
    });
    
    const plPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
    
    document.getElementById('portfolioTotal').textContent = formatCurrency(totalValue);
    
    const plSign = totalPL > 0 ? '+' : '';
    const plText = `${plSign}${formatCurrency(totalPL)} (${plSign}${plPercent.toFixed(2)}%)`;
    document.getElementById('portfolioPL').textContent = plText;
    
    const plElement = document.getElementById('portfolioPL');
    plElement.className = 'portfolio-pl';
    if (totalPL > 0) {
        plElement.classList.add('positive');
    } else if (totalPL < 0) {
        plElement.classList.add('negative');
    } else {
        plElement.classList.add('neutral');
    }
    
    // Update bar chart visualization
    // Simulate 5 holdings with varying values for visual effect
    const holdingsCount = Math.min(holdings.length, 5);
    const maxBarHeight = 35;
    
    if (holdings.length > 0) {
        // Sort holdings by value to create ascending bar chart
        const sortedHoldings = [...holdings].sort((a, b) => (a.value || 0) - (b.value || 0));
        
        for (let i = 0; i < 5; i++) {
            const bar = document.getElementById(`bar${i + 1}`);
            if (i < holdingsCount && sortedHoldings[i]) {
                const holdingValue = sortedHoldings[i].value || 0;
                const maxValue = Math.max(...sortedHoldings.map(h => h.value || 0));
                const barHeight = maxValue > 0 ? (holdingValue / maxValue) * maxBarHeight : 10;
                
                bar.setAttribute('height', barHeight);
                bar.setAttribute('y', 55 - barHeight);
            } else {
                // For empty bars, show small default height
                const defaultHeight = (i + 1) * 5;
                bar.setAttribute('height', defaultHeight);
                bar.setAttribute('y', 55 - defaultHeight);
            }
        }
    } else {
        // No holdings - show default pattern
        for (let i = 0; i < 5; i++) {
            const bar = document.getElementById(`bar${i + 1}`);
            const defaultHeight = (i + 1) * 6;
            bar.setAttribute('height', defaultHeight);
            bar.setAttribute('y', 55 - defaultHeight);
        }
    }
}

// Sort holdings
function sortHoldings(data) {
    const sorted = [...data];
    const { column, direction } = holdingsSort;
    
    sorted.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        // Handle null/undefined
        if (aVal === null || aVal === undefined) aVal = direction === 'asc' ? Infinity : -Infinity;
        if (bVal === null || bVal === undefined) bVal = direction === 'asc' ? Infinity : -Infinity;
        
        // Numeric columns
        const numericColumns = ['entry_price', 'current_price', 'pct_change', 'shares', 'value', 'pl_dollar', 'pl_percent'];
        if (numericColumns.includes(column)) {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else if (typeof aVal === 'string') {
            // String columns
            aVal = aVal.toUpperCase();
            bVal = bVal.toUpperCase();
        }
        
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    return sorted;
}

// Handle holdings table column sort
function sortHoldingsBy(column) {
    if (holdingsSort.column === column) {
        // Toggle direction
        holdingsSort.direction = holdingsSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // New column, default to ascending
        holdingsSort.column = column;
        holdingsSort.direction = 'asc';
    }
    renderHoldings();
    updateSortIndicators('holdings');
}

// Update sort indicators in table headers
function updateSortIndicators(tableType) {
    if (tableType === 'holdings') {
        document.querySelectorAll('#holdingsTable th.sortable').forEach(th => {
            const col = th.dataset.column;
            th.classList.remove('sort-asc', 'sort-desc');
            if (holdingsSort.column === col) {
                th.classList.add(`sort-${holdingsSort.direction}`);
            }
        });
    } else if (tableType === 'wishlist') {
        document.querySelectorAll('#wishlistTable th.sortable').forEach(th => {
            const col = th.dataset.column;
            th.classList.remove('sort-asc', 'sort-desc');
            if (wishlistSort.column === col) {
                th.classList.add(`sort-${wishlistSort.direction}`);
            }
        });
    }
}

// Render holdings table
function renderHoldings() {
    const tbody = document.getElementById('holdingsBody');
    
    if (holdings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="16" class="no-data">No holdings yet. Click "Add Holding" to get started.</td></tr>';
        updatePortfolioSummary();
        return;
    }
    
    // Sort holdings before rendering
    const sortedHoldings = sortHoldings(holdings);
    
    tbody.innerHTML = sortedHoldings.map(holding => `
        <tr class="holding-row">
            <td class="ticker-cell"><a href="/detail/${holding.ticker}" class="ticker-link">${holding.ticker}</a></td>
            <td>${holding.name || '-'}</td>
            <td>${holding.type || '-'}</td>
            <td>${formatDate(holding.add_date)}</td>
            <td>${formatCurrency(holding.entry_price)}</td>
            <td>${formatCurrency(holding.current_price)}</td>
            <td>${formatNumber(holding.shares)}</td>
            <td class="${getPLClass(holding.pct_change)}">
                ${formatPercentage(holding.pct_change)}
            </td>
            <td>${formatCurrency(holding.value)}</td>
            <td class="${getPLClass(holding.pl_dollar)}">${formatCurrency(holding.pl_dollar)}</td>
            <td>
                <span class="signal-${holding.signal.toLowerCase()}">
                    ${getSignalIcon(holding.signal)} ${holding.signal}
                </span>
            </td>
            <td>
                <span class="trend-${holding.short_trend === 'Bullish' ? 'bullish' : 'bearish'}">
                    ${holding.short_trend}
                </span>
            </td>
            <td>
                <span class="trend-${holding.med_trend === 'Bullish' ? 'bullish' : 'bearish'}">
                    ${holding.med_trend}
                </span>
            </td>
            <td>
                <span class="trend-${holding.long_trend === 'Bullish' ? 'golden' : 'death'}">
                    ${holding.long_trend}
                </span>
            </td>
            <td>${holding.week52_range || '-'}</td>
            <td class="actions-column">
                <div class="action-btns">
                    <button class="icon-btn icon-btn-edit" onclick="editHolding(${holding.id})" title="Edit">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="icon-btn icon-btn-delete" onclick="confirmDelete(${holding.id})" title="Delete">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    updatePortfolioSummary();
    updateSortIndicators('holdings');
}

// Show add modal
function showAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Add Holding';
    document.getElementById('holdingForm').reset();
    document.getElementById('holdingModal').style.display = 'block';
}

// Edit holding
function editHolding(id) {
    const holding = holdings.find(h => h.id === id);
    if (!holding) return;
    
    editingId = id;
    document.getElementById('modalTitle').textContent = 'Edit Holding';
    
    // Convert date format from dd/mm/yy to yyyy-mm-dd for input
    const convertDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return `20${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
    };
    
    document.getElementById('ticker').value = holding.ticker;
    document.getElementById('type').value = holding.type || '';
    document.getElementById('add_date').value = convertDateForInput(holding.add_date) || holding.add_date;
    document.getElementById('entry_price').value = holding.entry_price;
    document.getElementById('shares').value = holding.shares;
    document.getElementById('review_factors').value = holding.review_factors || '';
    document.getElementById('accumulate_price').value = holding.accumulate_price || '';
    document.getElementById('first_trim_price').value = holding.first_trim_price || '';
    document.getElementById('first_trim_percentage').value = holding.first_trim_percentage || '';
    document.getElementById('second_trim_price').value = holding.second_trim_price || '';
    document.getElementById('second_trim_percentage').value = holding.second_trim_percentage || '';
    document.getElementById('exit_price').value = holding.exit_price || '';
    
    document.getElementById('holdingModal').style.display = 'block';
}

// Close modal
function closeModal() {
    document.getElementById('holdingModal').style.display = 'none';
}

// Handle form submission
document.getElementById('holdingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        ticker: document.getElementById('ticker').value.toUpperCase(),
        type: document.getElementById('type').value,
        add_date: document.getElementById('add_date').value,
        entry_price: parseFloat(document.getElementById('entry_price').value),
        shares: parseFloat(document.getElementById('shares').value),
        review_date: null,
        review_factors: document.getElementById('review_factors').value,
        accumulate_price: document.getElementById('accumulate_price').value ? parseFloat(document.getElementById('accumulate_price').value) : null,
        first_trim_price: document.getElementById('first_trim_price').value ? parseFloat(document.getElementById('first_trim_price').value) : null,
        first_trim_percentage: document.getElementById('first_trim_percentage').value ? parseFloat(document.getElementById('first_trim_percentage').value) : null,
        second_trim_price: document.getElementById('second_trim_price').value ? parseFloat(document.getElementById('second_trim_price').value) : null,
        second_trim_percentage: document.getElementById('second_trim_percentage').value ? parseFloat(document.getElementById('second_trim_percentage').value) : null,
        exit_price: document.getElementById('exit_price').value ? parseFloat(document.getElementById('exit_price').value) : null
    };
    
    try {
        let response;
        if (editingId) {
            response = await fetch(`/api/holdings/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        } else {
            response = await fetch('/api/holdings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            closeModal();
            loadHoldings();
        } else {
            alert(result.error || 'Error saving holding');
        }
    } catch (error) {
        console.error('Error saving holding:', error);
        alert('Error saving holding. Please try again.');
    }
});

// Confirm delete
function confirmDelete(id) {
    confirmAction = () => deleteHolding(id);
    document.getElementById('confirmMessage').textContent = 'Are you sure you want to delete this holding?';
    document.getElementById('confirmModal').style.display = 'block';
}

// Delete holding
async function deleteHolding(id) {
    try {
        const response = await fetch(`/api/holdings/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            closeConfirmModal();
            loadHoldings();
        } else {
            alert('Error deleting holding');
        }
    } catch (error) {
        console.error('Error deleting holding:', error);
        alert('Error deleting holding. Please try again.');
    }
}

// Confirm clear all
function confirmClearAll() {
    confirmAction = clearAllHoldings;
    document.getElementById('confirmMessage').textContent = 'Are you sure you want to delete ALL holdings? This action cannot be undone.';
    document.getElementById('confirmModal').style.display = 'block';
}

// Clear all holdings
async function clearAllHoldings() {
    try {
        const response = await fetch('/api/holdings/clear', {
            method: 'DELETE'
        });
        
        if (response.ok) {
            closeConfirmModal();
            loadHoldings();
        } else {
            alert('Error clearing holdings');
        }
    } catch (error) {
        console.error('Error clearing holdings:', error);
        alert('Error clearing holdings. Please try again.');
    }
}

// Execute confirmed action
function executeConfirmedAction() {
    if (confirmAction) {
        confirmAction();
    }
}

// Close confirm modal
function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    confirmAction = null;
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// Wishlist functions
let wishlist = [];

async function loadWishlist() {
    try {
        const response = await fetch('/api/wishlist');
        wishlist = await response.json();
        renderWishlist();
    } catch (error) {
        console.error('Error loading wishlist:', error);
    }
}

// Sort wishlist
function sortWishlist(data) {
    const sorted = [...data];
    const { column, direction } = wishlistSort;
    
    sorted.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        // Handle null/undefined
        if (aVal === null || aVal === undefined) aVal = direction === 'asc' ? Infinity : -Infinity;
        if (bVal === null || bVal === undefined) bVal = direction === 'asc' ? Infinity : -Infinity;
        
        // Handle signal sorting (Buy > Hold > Sell)
        if (column === 'signal') {
            const signalOrder = { 'Buy': 3, 'Hold': 2, 'Sell': 1 };
            aVal = signalOrder[aVal] || 0;
            bVal = signalOrder[bVal] || 0;
        }
        // Numeric columns
        else if (['current_price', 'buy_price'].includes(column)) {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        }
        // String columns
        else if (typeof aVal === 'string') {
            aVal = aVal.toUpperCase();
            bVal = bVal.toUpperCase();
        }
        
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    return sorted;
}

// Handle wishlist table column sort
function sortWishlistBy(column) {
    if (wishlistSort.column === column) {
        // Toggle direction
        wishlistSort.direction = wishlistSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // New column, default to ascending
        wishlistSort.column = column;
        wishlistSort.direction = 'asc';
    }
    renderWishlist();
    updateSortIndicators('wishlist');
}

function renderWishlist() {
    const tbody = document.getElementById('wishlistBody');
    
    if (wishlist.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="no-data">No wishlist items yet. Click "Add to Wishlist" to get started.</td></tr>';
        return;
    }
    
    // Sort wishlist before rendering
    const sortedWishlist = sortWishlist(wishlist);
    
    tbody.innerHTML = sortedWishlist.map(item => `
        <tr class="holding-row">
            <td class="ticker-cell"><a href="/detail/${item.ticker}">${item.ticker}</a></td>
            <td>${item.name || '-'}</td>
            <td>${formatCurrency(item.current_price)}</td>
            <td>${item.buy_price ? formatCurrency(item.buy_price) : '-'}</td>
            <td>${item.week52_range || '-'}</td>
            <td>
                <span class="signal-${item.signal.toLowerCase()}">
                    ${getSignalIcon(item.signal)} ${item.signal}
                </span>
            </td>
            <td>
                <span class="trend-${item.short_trend === 'Bullish' ? 'bullish' : 'bearish'}">
                    ${item.short_trend}
                </span>
            </td>
            <td>
                <span class="trend-${item.med_trend === 'Bullish' ? 'bullish' : 'bearish'}">
                    ${item.med_trend}
                </span>
            </td>
            <td>
                <span class="trend-${item.long_trend === 'Bullish' ? 'golden' : 'death'}">
                    ${item.long_trend}
                </span>
            </td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; font-size: 0.8em;">${item.notes || '-'}</td>
            <td class="actions-column">
                <div class="action-btns">
                    <button class="icon-btn icon-btn-buy" onclick="buyFromWishlist(${item.id}, '${item.ticker}', ${item.buy_price || 0})" title="Buy (Add to Holdings)">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                    <button class="icon-btn icon-btn-edit" onclick="editWishlistItem(${item.id})" title="Edit">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="icon-btn icon-btn-delete" onclick="deleteWishlistItem(${item.id})" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    updateSortIndicators('wishlist');
}

function showAddWishlistModal() {
    document.getElementById('wishlistForm').reset();
    document.getElementById('wishlistId').value = '';
    document.getElementById('wishlistModalTitle').textContent = 'Add to Wishlist';
    document.getElementById('wishlistSubmitBtn').textContent = 'Add to Wishlist';
    document.getElementById('wishlistTicker').disabled = false;
    document.getElementById('wishlistModal').style.display = 'block';
}

function editWishlistItem(id) {
    const item = wishlist.find(w => w.id === id);
    if (!item) return;
    
    document.getElementById('wishlistId').value = id;
    document.getElementById('wishlistTicker').value = item.ticker;
    document.getElementById('wishlistBuyPrice').value = item.buy_price || '';
    document.getElementById('wishlistNotes').value = item.notes || '';
    document.getElementById('wishlistModalTitle').textContent = 'Edit Wishlist Item';
    document.getElementById('wishlistSubmitBtn').textContent = 'Update Wishlist';
    document.getElementById('wishlistTicker').disabled = true; // Don't allow changing ticker
    document.getElementById('wishlistModal').style.display = 'block';
}

function closeWishlistModal() {
    const modal = document.getElementById('wishlistModal');
    const tickerInput = document.getElementById('wishlistTicker');
    if (modal) modal.style.display = 'none';
    if (tickerInput) tickerInput.disabled = false;
}

function buyFromWishlist(id, ticker, buyPrice) {
    try {
        // Pre-fill the add holding modal with wishlist data
        const holdingForm = document.getElementById('holdingForm');
        const holdingModal = document.getElementById('holdingModal');
        const tickerInput = document.getElementById('ticker');
        const entryPriceInput = document.getElementById('entryPrice');
        const addDateInput = document.getElementById('addDate');
        const modalTitle = document.getElementById('modalTitle');
        const holdingId = document.getElementById('holdingId');
        
        if (!holdingForm || !holdingModal || !tickerInput) {
            alert('Unable to open holding form. Please refresh the page.');
            return;
        }
        
        holdingForm.reset();
        if (holdingId) holdingId.value = '';
        if (modalTitle) modalTitle.textContent = 'Add Holding';
        tickerInput.value = ticker;
        tickerInput.disabled = false;
        
        if (buyPrice && buyPrice > 0) {
            if (entryPriceInput) entryPriceInput.value = buyPrice;
        }
        
        if (addDateInput) {
            addDateInput.value = new Date().toISOString().split('T')[0];
        }
        
        holdingModal.style.display = 'block';
    } catch (error) {
        console.error('Error opening buy form:', error);
        alert('Error opening form. Please try again.');
    }
}

async function deleteWishlistItem(id) {
    if (!confirm('Remove this ticker from wishlist?')) return;
    
    try {
        const response = await fetch(`/api/wishlist/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadWishlist();
        } else {
            alert('Error removing from wishlist');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error removing from wishlist. Please try again.');
    }
}

// Auto-uppercase ticker inputs
document.addEventListener('DOMContentLoaded', function() {
    // Holdings form ticker
    const tickerInput = document.getElementById('ticker');
    if (tickerInput) {
        tickerInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
    }
    
    // Wishlist form ticker
    const wishlistTickerInput = document.getElementById('wishlistTicker');
    if (wishlistTickerInput) {
        wishlistTickerInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
    }
    
    // Setup wishlist form submission handler
    const wishlistForm = document.getElementById('wishlistForm');
    const wishlistSubmitBtn = document.getElementById('wishlistSubmitBtn');
    
    // Shared submit handler function
    async function handleWishlistSubmit(e) {
        if (e) e.preventDefault();
        
        const id = document.getElementById('wishlistId').value;
        const tickerInput = document.getElementById('wishlistTicker');
        const buyPriceInput = document.getElementById('wishlistBuyPrice');
        const notesInput = document.getElementById('wishlistNotes');
        const submitBtn = document.getElementById('wishlistSubmitBtn');
        
        if (!tickerInput) {
            alert('Form error. Please refresh the page.');
            return;
        }
        
        // Disable button during submission
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
        }
        
        try {
            // Get ticker value - if disabled (edit mode), get from the disabled input
            let tickerValue = tickerInput.value.trim().toUpperCase();
            
            if (!tickerValue) {
                alert('Please enter a ticker symbol');
                tickerInput.focus();
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = id ? 'Update Wishlist' : 'Add to Wishlist';
                }
                return;
            }
            
            const buyPriceValue = buyPriceInput ? buyPriceInput.value.trim() : '';
            const notesValue = notesInput ? notesInput.value.trim() : '';
            
            // Parse buy_price
            let buyPrice = null;
            if (buyPriceValue && buyPriceValue !== '') {
                buyPrice = parseFloat(buyPriceValue);
                if (isNaN(buyPrice) || buyPrice < 0) {
                    alert('Please enter a valid buy price (must be a positive number)');
                    if (buyPriceInput) buyPriceInput.focus();
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = id ? 'Update Wishlist' : 'Add to Wishlist';
                    }
                    return;
                }
            }
            
            const formData = {
                ticker: tickerValue,
                buy_price: buyPrice,
                notes: notesValue || ''
            };
            
            console.log('Submitting wishlist form:', formData);
            
            let response;
            if (id) {
                // Update existing - don't send ticker for PUT
                const updateData = {
                    buy_price: formData.buy_price,
                    notes: formData.notes
                };
                response = await fetch(`/api/wishlist/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
            } else {
                // Add new
                response = await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            }
            
            console.log('Response status:', response.status);
            
            let responseData;
            try {
                responseData = await response.json();
                console.log('Response data:', responseData);
            } catch (jsonError) {
                console.error('Error parsing JSON response:', jsonError);
                const textResponse = await response.text();
                console.error('Response text:', textResponse);
                throw new Error('Invalid response from server');
            }
            
            if (response.ok) {
                closeWishlistModal();
                loadWishlist();
            } else {
                const errorMsg = responseData.error || responseData.message || 'Error saving wishlist item';
                console.error('Error response:', responseData);
                alert(errorMsg);
            }
        } catch (error) {
            console.error('Error saving wishlist:', error);
            alert('Error saving wishlist item: ' + (error.message || 'Please check your connection and try again.'));
        } finally {
            // Re-enable button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = id ? 'Update Wishlist' : 'Add to Wishlist';
            }
        }
    }
    
    if (wishlistForm) {
        wishlistForm.addEventListener('submit', handleWishlistSubmit);
    }
    
    if (wishlistSubmitBtn) {
        wishlistSubmitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleWishlistSubmit(e);
        });
    }
});

// Initialize
updateDateTime();
setInterval(updateDateTime, 1000);
loadHoldings();
loadWishlist();
setInterval(loadHoldings, 30000); // Refresh every 30 seconds
setInterval(loadWishlist, 30000); // Refresh wishlist every 30 seconds

