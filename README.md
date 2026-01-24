# Portfolio Tracker

A simple web app to track your stock portfolio. Built with Flask and Python.

## Features

- Track your stock holdings
- See real-time stock prices (updates every 30 seconds)
- View detailed charts and technical indicators
- Add target prices (accumulate, trim, exit)
- Track wishlist of stocks you're watching
- Portfolio statistics and performance tracking

## Installation

1. Make sure you have Python 3.8 or higher installed
   ```bash
   python3 --version
   ```

2. Install dependencies:
   ```bash
   pip3 install -r requirements.txt
   ```

3. Run the app:
   ```bash
   python3 app.py
   ```

4. Open your browser and go to:
   ```
   http://localhost:5001
   ```

## Usage

- Click "Add Holding" to add a stock to your portfolio
- Fill in the ticker symbol, entry price, shares, and other details
- Click on any ticker in the table to see detailed charts and indicators
- Use the wishlist to track stocks you're interested in but haven't bought yet

## Technical Stack

- **Backend**: Flask (Python)
- **Database**: SQLite
- **Stock Data**: yfinance API
- **Charts**: Chart.js
- **Styling**: CSS (no frameworks, wanted to learn the basics)

## Understanding the Indicators

### Trend Indicators
- **Short**: Based on 10-day and 20-day moving averages (for day trading to weeks)
- **Med**: Based on 20-day and 50-day moving averages (for swing trading)
- **Long**: Based on 50-day and 200-day moving averages (for position trading)

### Buy/Hold/Sell Signals
- **Buy (Green)**: Bullish trends confirmed, RSI not overbought
- **Hold (Amber)**: Mixed signals or neutral conditions
- **Sell (Red)**: Bearish trends or overbought conditions

### RSI (Relative Strength Index)
- **Below 30**: Oversold (potential buy opportunity) - Green background
- **30-70**: Neutral range - Amber background
- **Above 70**: Overbought (potential sell signal) - Red background

### MACD
Shows momentum:
- Positive histogram: Bullish momentum
- Negative histogram: Bearish momentum
