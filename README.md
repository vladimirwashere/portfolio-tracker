# Portfolio Tracker

A simple web app to track your stock portfolio. Built with Flask and Python.

This is my first real project after completing [The Odin Project](https://www.theodinproject.com/). I'm still learning and improving it!

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

## Troubleshooting

### "Address already in use" error
The port is already taken. Either:
- Find and stop the existing process, or
- Change the port in `app.py` (change `port=5001` to another number)

### Can't access from iPhone
1. Verify both devices are on the same Wi-Fi
2. Check your Mac's firewall settings
3. Make sure the Terminal is still running the app

### Stock data not loading
1. Check your internet connection
2. Verify the ticker symbol is correct
3. Some stocks may not have complete historical data

## What I Learned

Building this project taught me:
- Flask and backend development
- Working with APIs (yfinance)
- Database design with SQLite
- JavaScript for dynamic frontend
- Technical analysis indicators
- Chart visualization

## Future Improvements

- Add user authentication
- Portfolio performance over time
- Email alerts for price targets
- More technical indicators
- Export data to CSV

## Notes

This is a learning project. I'm sure there are things I could do better, but I'm happy with what I've built so far!

## License

MIT
