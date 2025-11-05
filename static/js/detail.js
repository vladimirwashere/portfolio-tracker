// Global variables
let stockData = null;
let priceChart = null;
let holding = null;
let activeIndicators = ['price', 'targets'];

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

// Format currency
function formatCurrency(value) {
    if (value === null || value === undefined || value === 0) return '-';
    return `$${parseFloat(value).toFixed(2)}`;
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

// Update RSI card styling based on value
function updateRSICard(elementId, value) {
    const card = document.getElementById(elementId + 'Card');
    card.classList.remove('oversold', 'overbought', 'neutral');
    
    if (value < 30) {
        card.classList.add('oversold');
    } else if (value > 70) {
        card.classList.add('overbought');
    } else {
        card.classList.add('neutral');
    }
}

// Color code MACD value
function colorCodeMACD(value) {
    const className = value > 0 ? 'macd-positive' : 'macd-negative';
    return `<span class="${className}">${value.toFixed(2)}</span>`;
}

// Load holding data
async function loadHoldingData() {
    try {
        const response = await fetch('/api/holdings');
        const holdings = await response.json();
        holding = holdings.find(h => h.ticker === TICKER);
        
        if (holding) {
            updateTargetPrices();
        }
    } catch (error) {
        console.error('Error loading holding data:', error);
    }
}

// Update target prices display
function updateTargetPrices() {
    if (!holding) return;
    
    // Review factors
    const reviewText = holding.review_factors || 'No strategy notes';
    document.getElementById('reviewFactors').innerHTML = formatReviewFactors(reviewText);
    
    // Target prices
    document.getElementById('targetAcc').textContent = holding.accumulate_price ? formatCurrency(holding.accumulate_price) : '-';
    document.getElementById('targetTrim1').textContent = holding.first_trim_price ? formatCurrency(holding.first_trim_price) : '-';
    document.getElementById('targetTrim1Pct').textContent = holding.first_trim_percentage ? `(${holding.first_trim_percentage}%)` : '';
    document.getElementById('targetTrim2').textContent = holding.second_trim_price ? formatCurrency(holding.second_trim_price) : '-';
    document.getElementById('targetTrim2Pct').textContent = holding.second_trim_percentage ? `(${holding.second_trim_percentage}%)` : '';
    document.getElementById('targetExit').textContent = holding.exit_price ? formatCurrency(holding.exit_price) : '-';
}

// Format review factors with bold text
function formatReviewFactors(text) {
    if (!text) return 'No strategy notes';
    // Convert **text** to <strong>text</strong>
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// Format volume
function formatVolume(value) {
    if (!value || value === 0) return 'N/A';
    
    if (value >= 1e9) {
        return `${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
        return `${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
        return `${(value / 1e3).toFixed(2)}K`;
    }
    return value.toFixed(0);
}

// Load earnings date using backend endpoint
async function loadEarningsDate() {
    try {
        const response = await fetch(`/api/earnings/${TICKER}`);
        const data = await response.json();
        
        if (data.available && data.date) {
            const earningsDate = new Date(data.date * 1000);
            
            const formattedDate = earningsDate.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
                document.getElementById('earningsDate').textContent = formattedDate;
                const earningsLink = document.getElementById('earningsLink');
                earningsLink.href = `https://finance.yahoo.com/calendar/earnings?symbol=${TICKER}`;
                earningsLink.textContent = 'View Earnings Calendar';
                earningsLink.style.display = 'inline-block';
            } else {
                // If not available, show link to check manually
                document.getElementById('earningsDate').textContent = 'Not available';
                const earningsLink = document.getElementById('earningsLink');
                earningsLink.href = `https://finance.yahoo.com/calendar/earnings?symbol=${TICKER}`;
                earningsLink.textContent = 'Check Earnings Calendar';
                earningsLink.style.display = 'inline-block';
            }
    } catch (error) {
        console.error('Error loading earnings date:', error);
        document.getElementById('earningsDate').textContent = 'Error loading';
        const earningsLink = document.getElementById('earningsLink');
        earningsLink.href = `https://finance.yahoo.com/calendar/earnings?symbol=${TICKER}`;
        earningsLink.textContent = 'Check Earnings Calendar';
        earningsLink.style.display = 'inline-block';
    }
}

// Load company logo
function loadCompanyLogo() {
    // Use clearbit logo API
    const logoUrl = `https://logo.clearbit.com/${getCompanyDomain(TICKER)}.com`;
    const logoImg = document.getElementById('companyLogo');
    
    // Try to load logo
    const testImg = new Image();
    testImg.onload = function() {
        logoImg.src = logoUrl;
        logoImg.style.display = 'block';
    };
    testImg.onerror = function() {
        // Fallback to first letter avatar
        logoImg.style.display = 'none';
    };
    testImg.src = logoUrl;
}

// Get company domain from ticker (simple mapping for common stocks)
function getCompanyDomain(ticker) {
    const domainMap = {
        'AAPL': 'apple',
        'MSFT': 'microsoft',
        'GOOGL': 'google',
        'GOOG': 'google',
        'AMZN': 'amazon',
        'TSLA': 'tesla',
        'META': 'meta',
        'NVDA': 'nvidia',
        'AMD': 'amd',
        'NFLX': 'netflix',
        'DIS': 'disney',
        'PYPL': 'paypal',
        'INTC': 'intel',
        'CSCO': 'cisco',
        'ORCL': 'oracle',
        'IBM': 'ibm',
        'QCOM': 'qualcomm',
        'TXN': 'ti',
        'AVGO': 'broadcom',
        'ADBE': 'adobe'
    };
    
    return domainMap[ticker.toUpperCase()] || ticker.toLowerCase();
}

// Load stock data
async function loadStockData() {
    try {
        const response = await fetch(`/api/stock/${TICKER}?period=${currentPeriod}`);
        stockData = await response.json();
        
        if (response.ok) {
            updateIndicators();
            createChart();
        } else {
            alert('Error loading stock data');
        }
    } catch (error) {
        console.error('Error loading stock data:', error);
        alert('Error loading stock data. Please try again.');
    }
}

// Update indicators
function updateIndicators() {
    document.getElementById('tickerTitle').textContent = `${TICKER} - ${stockData.name}`;
    
    // Load company logo
    loadCompanyLogo();
    
    // Display current price
    document.getElementById('currentPriceDisplay').textContent = formatCurrency(stockData.current_price);
    document.getElementById('currentPriceMA').textContent = formatCurrency(stockData.current_price);
    
    // Key metrics
    document.getElementById('marketCap').textContent = formatMarketCap(stockData.market_cap);
    document.getElementById('beta').textContent = stockData.beta ? stockData.beta.toFixed(2) : 'N/A';
    document.getElementById('volume').textContent = formatVolume(stockData.volume);
    document.getElementById('atr').textContent = stockData.atr ? stockData.atr.toFixed(2) : 'N/A';
    document.getElementById('adx').textContent = stockData.adx ? stockData.adx.toFixed(2) : 'N/A';
    
    // Calculate and display stop-loss
    const stopLoss = stockData.current_price - (2 * stockData.atr);
    document.getElementById('stopLoss').textContent = formatCurrency(stopLoss > 0 ? stopLoss : 0);
    
    // RSI values with conditional formatting
    document.getElementById('rsi7').textContent = stockData.rsi7.toFixed(2);
    updateRSICard('rsi7', stockData.rsi7);
    
    document.getElementById('rsi14').textContent = stockData.rsi14.toFixed(2);
    updateRSICard('rsi14', stockData.rsi14);
    
    document.getElementById('rsi21').textContent = stockData.rsi21.toFixed(2);
    updateRSICard('rsi21', stockData.rsi21);
    
    // Moving averages
    document.getElementById('ema10').textContent = formatCurrency(stockData.ema10);
    document.getElementById('ema20').textContent = formatCurrency(stockData.ema20);
    document.getElementById('sma20').textContent = formatCurrency(stockData.sma20);
    document.getElementById('sma50').textContent = formatCurrency(stockData.sma50);
    document.getElementById('sma200').textContent = formatCurrency(stockData.sma200);
    
    // MACD values with color coding
    document.getElementById('macdShort').innerHTML = `
        MACD: ${colorCodeMACD(stockData.macd_short)}<br>
        Signal: ${stockData.macd_short_signal.toFixed(2)}<br>
        Hist: ${colorCodeMACD(stockData.macd_short_diff)}
    `;
    
    document.getElementById('macdMed').innerHTML = `
        MACD: ${colorCodeMACD(stockData.macd_med)}<br>
        Signal: ${stockData.macd_med_signal.toFixed(2)}<br>
        Hist: ${colorCodeMACD(stockData.macd_med_diff)}
    `;
    
    document.getElementById('macdLong').innerHTML = `
        MACD: ${colorCodeMACD(stockData.macd_long)}<br>
        Signal: ${stockData.macd_long_signal.toFixed(2)}<br>
        Hist: ${colorCodeMACD(stockData.macd_long_diff)}
    `;
    
    // Bollinger Bands
    document.getElementById('bbUpper').textContent = formatCurrency(stockData.bb_upper);
    document.getElementById('bbMiddle').textContent = formatCurrency(stockData.bb_middle);
    document.getElementById('bbLower').textContent = formatCurrency(stockData.bb_lower);
    
    // OBV
    document.getElementById('obv').textContent = formatVolume(stockData.obv);
}

// Create price chart with dynamic indicators
function createChart() {
    const ctx = document.getElementById('priceChart').getContext('2d');
    const priceData = stockData.history.Close;
    
    // Create proper date labels (1 year = ~365 days)
    const today = new Date();
    const labels = priceData.map((_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - (priceData.length - i - 1));
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    });
    
    const datasets = [];
    
    // Price line
    if (activeIndicators.includes('price')) {
        datasets.push({
            label: 'Price',
            data: priceData,
            borderColor: '#000',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1,
            yAxisID: 'y'
        });
    }
    
    // Target price lines
    if (activeIndicators.includes('targets') && holding) {
        if (holding.accumulate_price) {
            datasets.push({
                label: 'Accumulate',
                data: Array(priceData.length).fill(holding.accumulate_price),
                borderColor: '#28a745',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                yAxisID: 'y'
            });
        }
        
        if (holding.first_trim_price) {
            datasets.push({
                label: `First Trim ${holding.first_trim_percentage ? '(' + holding.first_trim_percentage + '%)' : ''}`,
                data: Array(priceData.length).fill(holding.first_trim_price),
                borderColor: '#ffc107',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                yAxisID: 'y'
            });
        }
        
        if (holding.second_trim_price) {
            datasets.push({
                label: `Second Trim ${holding.second_trim_percentage ? '(' + holding.second_trim_percentage + '%)' : ''}`,
                data: Array(priceData.length).fill(holding.second_trim_price),
                borderColor: '#fd7e14',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                yAxisID: 'y'
            });
        }
        
        if (holding.exit_price) {
            datasets.push({
                label: 'Exit',
                data: Array(priceData.length).fill(holding.exit_price),
                borderColor: '#dc3545',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                yAxisID: 'y'
            });
        }
    }
    
    // Moving averages
    if (activeIndicators.includes('ema10')) {
        datasets.push({
            label: 'EMA10',
            data: Array(priceData.length).fill(stockData.ema10),
            borderColor: '#007bff',
            borderWidth: 1,
            pointRadius: 0,
            yAxisID: 'y'
        });
    }
    
    if (activeIndicators.includes('ema20')) {
        datasets.push({
            label: 'EMA20',
            data: Array(priceData.length).fill(stockData.ema20),
            borderColor: '#0056b3',
            borderWidth: 1,
            pointRadius: 0,
            yAxisID: 'y'
        });
    }
    
    if (activeIndicators.includes('sma20')) {
        datasets.push({
            label: 'SMA20',
            data: Array(priceData.length).fill(stockData.sma20),
            borderColor: '#6610f2',
            borderWidth: 1,
            pointRadius: 0,
            yAxisID: 'y'
        });
    }
    
    if (activeIndicators.includes('sma50')) {
        datasets.push({
            label: 'SMA50',
            data: Array(priceData.length).fill(stockData.sma50),
            borderColor: '#e83e8c',
            borderWidth: 1,
            pointRadius: 0,
            yAxisID: 'y'
        });
    }
    
    if (activeIndicators.includes('sma200')) {
        datasets.push({
            label: 'SMA200',
            data: Array(priceData.length).fill(stockData.sma200),
            borderColor: '#fd7e14',
            borderWidth: 2,
            pointRadius: 0,
            yAxisID: 'y'
        });
    }
    
    // Bollinger Bands
    if (activeIndicators.includes('bb')) {
        datasets.push({
            label: 'BB Upper',
            data: Array(priceData.length).fill(stockData.bb_upper),
            borderColor: 'rgba(156, 39, 176, 0.5)',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            yAxisID: 'y'
        });
        
        datasets.push({
            label: 'BB Middle',
            data: Array(priceData.length).fill(stockData.bb_middle),
            borderColor: 'rgba(156, 39, 176, 0.7)',
            borderWidth: 1,
            pointRadius: 0,
            yAxisID: 'y'
        });
        
        datasets.push({
            label: 'BB Lower',
            data: Array(priceData.length).fill(stockData.bb_lower),
            borderColor: 'rgba(156, 39, 176, 0.5)',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            yAxisID: 'y'
        });
    }
    
    // RSI overlay (removed as it doesn't make sense on price chart)
    if (activeIndicators.includes('rsi')) {
        const rsiValue = stockData.rsi14;
        datasets.push({
            label: 'RSI',
            data: Array(priceData.length).fill(rsiValue),
            borderColor: '#20c997',
            borderWidth: 1,
            pointRadius: 0,
            yAxisID: 'rsi'
        });
    }
    
    // MACD overlay
    if (activeIndicators.includes('macd')) {
        const macdValue = stockData.macd_short;
        datasets.push({
            label: 'MACD',
            data: Array(priceData.length).fill(macdValue),
            borderColor: '#17a2b8',
            borderWidth: 1,
            pointRadius: 0,
            yAxisID: 'macd'
        });
    }
    
    if (priceChart) {
        priceChart.destroy();
    }
    
    const scales = {
        x: {
            display: true,
            ticks: {
                maxRotation: 45,
                minRotation: 45,
                autoSkip: true,
                maxTicksLimit: 12,
                font: {
                    size: 10
                },
                color: '#86868b'
            },
            grid: {
                display: false
            }
        },
        y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: false,
            ticks: {
                callback: function(value) {
                    return '$' + value.toFixed(2);
                },
                font: {
                    size: 11
                },
                color: '#1d1d1f'
            },
            grid: {
                color: 'rgba(0, 0, 0, 0.05)',
                lineWidth: 1
            }
        }
    };
    
    // Add RSI scale if active
    if (activeIndicators.includes('rsi')) {
        scales.rsi = {
            type: 'linear',
            display: true,
            position: 'right',
            min: 0,
            max: 100,
            grid: {
                drawOnChartArea: false
            }
        };
    }
    
    // Add MACD scale if active
    if (activeIndicators.includes('macd')) {
        scales.macd = {
            type: 'linear',
            display: true,
            position: 'right',
            grid: {
                drawOnChartArea: false
            }
        };
    }
    
    // Destroy existing chart to prevent memory leaks and collapsing
    if (priceChart) {
        priceChart.destroy();
        priceChart = null;
    }
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: scales,
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Toggle indicator on chart
function toggleIndicator(indicator) {
    const index = activeIndicators.indexOf(indicator);
    
    if (index > -1) {
        activeIndicators.splice(index, 1);
    } else {
        activeIndicators.push(indicator);
    }
    
    createChart();
}

// Setup toolbar listeners
function setupToolbar() {
    const toolbarButtons = document.querySelectorAll('.toolbar-btn');
    
    toolbarButtons.forEach(button => {
        button.addEventListener('click', () => {
            const indicator = button.getAttribute('data-indicator');
            button.classList.toggle('active');
            toggleIndicator(indicator);
        });
    });
}

// Load news
async function loadNews() {
    try {
        const response = await fetch(`/api/news/${TICKER}`);
        const news = await response.json();
        
        const newsFeed = document.getElementById('newsFeed');
        
        if (news.length === 0) {
            newsFeed.innerHTML = '<p class="loading">No news available</p>';
            return;
        }
        
        newsFeed.innerHTML = news.map(item => {
            const date = new Date(item.published * 1000);
            const formattedDate = date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="news-item">
                    <a href="${item.link}" target="_blank">${item.title}</a>
                    <div class="news-meta">
                        <span>${item.publisher}</span>
                        <span>${formattedDate}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading news:', error);
        document.getElementById('newsFeed').innerHTML = '<p class="loading">Error loading news</p>';
    }
}

// Zoom controls functionality
let currentPeriod = '1y';

document.querySelectorAll('.zoom-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.zoom-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentPeriod = this.dataset.period;
        loadStockData(); // Reload data with new period
    });
});

// Initialize
updateDateTime();
setInterval(updateDateTime, 1000);

// Load data sequentially
loadHoldingData().then(() => {
    loadStockData();
    loadEarningsDate();
    setupToolbar();
});

loadNews();

// Edit Target Modal Functions
let currentEditField = null;

function openEditModal(fieldType) {
    if (!holding) {
        alert('Holding data not loaded yet. Please wait...');
        return;
    }
    
    currentEditField = fieldType;
    const modal = document.getElementById('editTargetModal');
    const title = document.getElementById('editTargetModalTitle');
    const formContent = document.getElementById('editTargetFormContent');
    
    // Clear previous content
    formContent.innerHTML = '';
    
    // Set title and form based on field type
    switch(fieldType) {
        case 'review_factors':
            title.textContent = 'Edit Review Factors / Strategy';
            formContent.innerHTML = `
                <div class="form-group full-width">
                    <label for="editReviewFactors">Review Factors / Strategy (use **text** for bold)</label>
                    <textarea id="editReviewFactors" rows="4" style="width: 100%; padding: 10px; border: 1px solid rgba(0,0,0,0.1); border-radius: 10px; font-family: inherit;">${holding.review_factors || ''}</textarea>
                </div>
            `;
            break;
            
        case 'accumulate_price':
            title.textContent = 'Edit Accumulate Price';
            formContent.innerHTML = `
                <div class="form-group full-width">
                    <label for="editAccumulatePrice">Accumulate Price ($)</label>
                    <input type="number" id="editAccumulatePrice" step="0.01" value="${holding.accumulate_price || ''}">
                </div>
            `;
            break;
            
        case 'first_trim':
            title.textContent = 'Edit First Trim';
            formContent.innerHTML = `
                <div class="form-group full-width">
                    <label for="editFirstTrimPrice">First Trim Price ($)</label>
                    <input type="number" id="editFirstTrimPrice" step="0.01" value="${holding.first_trim_price || ''}">
                </div>
                <div class="form-group full-width">
                    <label for="editFirstTrimPct">First Trim Percentage (%)</label>
                    <input type="number" id="editFirstTrimPct" step="0.1" value="${holding.first_trim_percentage || ''}">
                </div>
            `;
            break;
            
        case 'second_trim':
            title.textContent = 'Edit Second Trim';
            formContent.innerHTML = `
                <div class="form-group full-width">
                    <label for="editSecondTrimPrice">Second Trim Price ($)</label>
                    <input type="number" id="editSecondTrimPrice" step="0.01" value="${holding.second_trim_price || ''}">
                </div>
                <div class="form-group full-width">
                    <label for="editSecondTrimPct">Second Trim Percentage (%)</label>
                    <input type="number" id="editSecondTrimPct" step="0.1" value="${holding.second_trim_percentage || ''}">
                </div>
            `;
            break;
            
        case 'exit_price':
            title.textContent = 'Edit Exit Price';
            formContent.innerHTML = `
                <div class="form-group full-width">
                    <label for="editExitPrice">Exit Price ($)</label>
                    <input type="number" id="editExitPrice" step="0.01" value="${holding.exit_price || ''}">
                </div>
            `;
            break;
    }
    
    modal.style.display = 'block';
}

function closeEditModal() {
    const modal = document.getElementById('editTargetModal');
    modal.style.display = 'none';
    currentEditField = null;
}

// Handle form submission
function setupEditFormListener() {
    const editForm = document.getElementById('editTargetForm');
    if (editForm) {
        // Remove existing listener if any
        editForm.removeEventListener('submit', handleEditSubmit);
        editForm.addEventListener('submit', handleEditSubmit);
    }
}

// Setup listener when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEditFormListener);
} else {
    // DOM already loaded
    setupEditFormListener();
}

async function handleEditSubmit(e) {
    e.preventDefault();
    
    if (!holding || !currentEditField) return;
    
    const updateData = {
        ticker: holding.ticker,
        type: holding.type,
        add_date: holding.add_date,
        entry_price: holding.entry_price,
        shares: holding.shares,
        review_date: holding.review_date,
        review_factors: holding.review_factors,
        accumulate_price: holding.accumulate_price,
        first_trim_price: holding.first_trim_price,
        first_trim_percentage: holding.first_trim_percentage,
        second_trim_price: holding.second_trim_price,
        second_trim_percentage: holding.second_trim_percentage,
        exit_price: holding.exit_price
    };
    
    // Update based on field type
    switch(currentEditField) {
        case 'review_factors':
            updateData.review_factors = document.getElementById('editReviewFactors').value.trim();
            break;
            
        case 'accumulate_price':
            const accPrice = document.getElementById('editAccumulatePrice').value;
            updateData.accumulate_price = accPrice ? parseFloat(accPrice) : null;
            break;
            
        case 'first_trim':
            const trim1Price = document.getElementById('editFirstTrimPrice').value;
            const trim1Pct = document.getElementById('editFirstTrimPct').value;
            updateData.first_trim_price = trim1Price ? parseFloat(trim1Price) : null;
            updateData.first_trim_percentage = trim1Pct ? parseFloat(trim1Pct) : null;
            break;
            
        case 'second_trim':
            const trim2Price = document.getElementById('editSecondTrimPrice').value;
            const trim2Pct = document.getElementById('editSecondTrimPct').value;
            updateData.second_trim_price = trim2Price ? parseFloat(trim2Price) : null;
            updateData.second_trim_percentage = trim2Pct ? parseFloat(trim2Pct) : null;
            break;
            
        case 'exit_price':
            const exitPrice = document.getElementById('editExitPrice').value;
            updateData.exit_price = exitPrice ? parseFloat(exitPrice) : null;
            break;
    }
    
    try {
        const response = await fetch(`/api/holdings/${holding.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            // Reload holding data to get updated values
            await loadHoldingData();
            closeEditModal();
        } else {
            const error = await response.json();
            alert('Error updating: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating holding:', error);
        alert('Error updating holding. Please try again.');
    }
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('editTargetModal');
    if (event.target === modal) {
        closeEditModal();
    }
});

// Refresh intervals
let dataRefreshInterval = setInterval(() => {
    loadHoldingData().then(() => {
        loadStockData();
    });
}, 30000); // Refresh every 30 seconds

setInterval(loadNews, 600000); // Refresh news every 10 minutes
