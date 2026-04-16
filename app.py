import os
import re
import logging
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import sqlite3
import yfinance as yf
import pandas as pd
from datetime import datetime
import ta

app = Flask(__name__)

# Configure CORS with specific origins
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5001,http://127.0.0.1:5001").split(
    ","
)
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "PUT", "DELETE"],
            "allow_headers": ["Content-Type"],
        }
    },
)

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Input validation functions
def sanitize_ticker(ticker):
    """Validate and sanitize ticker symbol."""
    if not ticker:
        raise ValueError("Ticker symbol is required")
    ticker = ticker.upper().strip()
    # Only allow alphanumeric characters, dots, and hyphens (max 10 chars)
    if not re.match(r"^[A-Z0-9.\-]{1,10}$", ticker):
        raise ValueError("Invalid ticker format. Use only letters, numbers, dots, and hyphens")
    return ticker


def validate_price(price, field_name="Price"):
    """Validate price input."""
    if price is None:
        return None
    try:
        price = float(price)
        if price <= 0:
            raise ValueError(f"{field_name} must be positive")
        if price > 10000000:  # 10 million max
            raise ValueError(f"{field_name} exceeds maximum allowed value")
        return price
    except (TypeError, ValueError) as e:
        raise ValueError(f"Invalid {field_name}: {e}")


def validate_shares(shares):
    """Validate share amount."""
    try:
        shares = float(shares)
        if shares <= 0:
            raise ValueError("Shares must be positive")
        if shares > 1000000:  # 1 million shares max
            raise ValueError("Share amount exceeds maximum allowed")
        return shares
    except (TypeError, ValueError) as e:
        raise ValueError(f"Invalid share amount: {e}")


# Set up database
def init_db():
    conn = sqlite3.connect("portfolio.db")
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            type TEXT,
            add_date TEXT NOT NULL,
            entry_price REAL NOT NULL,
            shares REAL NOT NULL,
            review_date TEXT,
            review_factors TEXT,
            accumulate_price REAL,
            first_trim_price REAL,
            first_trim_percentage REAL,
            second_trim_price REAL,
            second_trim_percentage REAL,
            exit_price REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS wishlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL UNIQUE,
            buy_price REAL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Add buy_price column if missing (for old databases)
    try:
        c.execute("SELECT buy_price FROM wishlist LIMIT 1")
    except sqlite3.OperationalError:
        # Column missing, add it
        print("Adding buy_price column to wishlist table")
        c.execute("ALTER TABLE wishlist ADD COLUMN buy_price REAL")

    conn.commit()
    conn.close()


# Create database when app starts
init_db()


# Get database connection
def get_db():
    conn = sqlite3.connect("portfolio.db")
    conn.row_factory = sqlite3.Row
    return conn


# Check if ticker is valid
def validate_ticker(ticker):
    """Validate ticker symbol with yfinance API."""
    try:
        # First sanitize the ticker format
        ticker = sanitize_ticker(ticker)
        stock = yf.Ticker(ticker)
        info = stock.info

        # Check if info is valid
        if info and (len(info) > 0):
            has_symbol = "symbol" in info and info.get("symbol")
            has_name = "shortName" in info or "longName" in info
            if has_symbol or has_name:
                return True
        # Info is empty or invalid
        return False
    except ValueError:
        # Re-raise validation errors
        raise
    except Exception as e:
        logger.error(f"Error validating ticker {ticker}: {e}")
        return False


# Convert period string to number of days
def get_period_days(period):
    period_map = {"1d": 1, "5d": 5, "1m": 30, "3m": 90, "6m": 180, "1y": 365, "2y": 730, "5y": 1825}
    return period_map.get(period, 365)


# Get stock data from yfinance
def get_stock_data(ticker, period="1y"):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        # Get 2 years of history (need it for 200-day SMA)
        hist = stock.history(period="2y")

        if hist.empty:
            return None

        current_price = hist["Close"].iloc[-1]

        # Calculate indicators
        df = hist.copy()

        # EMA calculations
        df["EMA10"] = df["Close"].ewm(span=10, adjust=False).mean()
        df["EMA20"] = df["Close"].ewm(span=20, adjust=False).mean()

        # SMA calculations
        df["SMA20"] = df["Close"].rolling(window=20).mean()
        df["SMA50"] = df["Close"].rolling(window=50).mean()
        df["SMA200"] = df["Close"].rolling(window=200).mean()

        # RSI
        df["RSI7"] = ta.momentum.rsi(df["Close"], window=7)
        df["RSI14"] = ta.momentum.rsi(df["Close"], window=14)
        df["RSI21"] = ta.momentum.rsi(df["Close"], window=21)

        # MACD calculations
        # Short term: 12-26-9
        macd_short = ta.trend.MACD(df["Close"], window_slow=26, window_fast=12, window_sign=9)
        df["MACD_short"] = macd_short.macd()
        df["MACD_short_signal"] = macd_short.macd_signal()
        df["MACD_short_diff"] = macd_short.macd_diff()

        # Medium term: 19-39-9
        macd_med = ta.trend.MACD(df["Close"], window_slow=39, window_fast=19, window_sign=9)
        df["MACD_med"] = macd_med.macd()
        df["MACD_med_signal"] = macd_med.macd_signal()
        df["MACD_med_diff"] = macd_med.macd_diff()

        # Long term: 26-52-9
        macd_long = ta.trend.MACD(df["Close"], window_slow=52, window_fast=26, window_sign=9)
        df["MACD_long"] = macd_long.macd()
        df["MACD_long_signal"] = macd_long.macd_signal()
        df["MACD_long_diff"] = macd_long.macd_diff()

        # ATR (Average True Range) - 14 period
        df["ATR"] = ta.volatility.average_true_range(df["High"], df["Low"], df["Close"], window=14)

        # ADX (Average Directional Index) - 14 period
        df["ADX"] = ta.trend.adx(df["High"], df["Low"], df["Close"], window=14)

        # Bollinger Bands - 20 period, 2 std dev
        bollinger = ta.volatility.BollingerBands(df["Close"], window=20, window_dev=2)
        df["BB_upper"] = bollinger.bollinger_hband()
        df["BB_middle"] = bollinger.bollinger_mavg()
        df["BB_lower"] = bollinger.bollinger_lband()

        # OBV (On Balance Volume)
        df["OBV"] = ta.volume.on_balance_volume(df["Close"], df["Volume"])

        # Get current values
        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest

        # Current volume
        latest_volume = latest["Volume"] if "Volume" in df.columns else 0

        # Calculate trends
        # Short: EMA10/EMA20 + MACD + RSI
        short_trend = (
            "Bullish"
            if (
                latest["EMA10"] > latest["EMA20"]
                and latest["MACD_short_diff"] > 0
                and latest["RSI14"] > prev["RSI14"]
            )
            else "Bearish"
        )

        # Medium: SMA20/SMA50 + MACD + RSI
        med_trend = (
            "Bullish"
            if (
                latest["SMA20"] > latest["SMA50"]
                and latest["MACD_med_diff"] > 0
                and latest["RSI14"] > 40
            )
            else "Bearish"
        )

        # Long: SMA50/SMA200 + MACD
        long_trend = (
            "Bullish"
            if (latest["SMA50"] > latest["SMA200"] and latest["MACD_long_diff"] > 0)
            else "Bearish"
        )

        # Calculate buy/sell/hold signal
        # Buy: all trends up and RSI not too high
        # Sell: all trends down or RSI too high
        # Hold: mixed
        if short_trend == "Bullish" and med_trend == "Bullish" and latest["RSI14"] < 70:
            signal = "Buy"
        elif short_trend == "Bearish" and med_trend == "Bearish" or latest["RSI14"] > 75:
            signal = "Sell"
        else:
            signal = "Hold"

        # 52 week range
        week52_high = df["High"].rolling(window=252).max().iloc[-1]
        week52_low = df["Low"].rolling(window=252).min().iloc[-1]

        # If not enough days, use all available data
        if pd.isna(week52_high) or pd.isna(week52_low):
            week52_high = df["High"].max()
            week52_low = df["Low"].min()

        # Make sure numbers are valid
        if pd.isna(week52_high) or pd.isna(week52_low):
            week52_high = float(current_price) * 2  # Fallback: estimate high
            week52_low = float(current_price) * 0.5  # Fallback: estimate low

        return {
            "name": info.get("shortName", info.get("longName", ticker)),
            "current_price": float(current_price),
            "week52_high": float(week52_high),
            "week52_low": float(week52_low),
            "market_cap": info.get("marketCap", 0),
            "beta": info.get("beta", 0),
            "volume": float(latest_volume),
            "atr": float(latest["ATR"]) if not pd.isna(latest["ATR"]) else 0,
            "adx": float(latest["ADX"]) if not pd.isna(latest["ADX"]) else 0,
            "bb_upper": float(latest["BB_upper"]) if not pd.isna(latest["BB_upper"]) else 0,
            "bb_middle": float(latest["BB_middle"]) if not pd.isna(latest["BB_middle"]) else 0,
            "bb_lower": float(latest["BB_lower"]) if not pd.isna(latest["BB_lower"]) else 0,
            "obv": float(latest["OBV"]) if not pd.isna(latest["OBV"]) else 0,
            "rsi7": float(latest["RSI7"]) if not pd.isna(latest["RSI7"]) else 50,
            "rsi14": float(latest["RSI14"]) if not pd.isna(latest["RSI14"]) else 50,
            "rsi21": float(latest["RSI21"]) if not pd.isna(latest["RSI21"]) else 50,
            "ema10": float(latest["EMA10"]) if not pd.isna(latest["EMA10"]) else 0,
            "ema20": float(latest["EMA20"]) if not pd.isna(latest["EMA20"]) else 0,
            "sma20": float(latest["SMA20"]) if not pd.isna(latest["SMA20"]) else 0,
            "sma50": float(latest["SMA50"]) if not pd.isna(latest["SMA50"]) else 0,
            "sma200": float(latest["SMA200"]) if not pd.isna(latest["SMA200"]) else 0,
            "macd_short": float(latest["MACD_short"]) if not pd.isna(latest["MACD_short"]) else 0,
            "macd_short_signal": (
                float(latest["MACD_short_signal"])
                if not pd.isna(latest["MACD_short_signal"])
                else 0
            ),
            "macd_short_diff": (
                float(latest["MACD_short_diff"]) if not pd.isna(latest["MACD_short_diff"]) else 0
            ),
            "macd_med": float(latest["MACD_med"]) if not pd.isna(latest["MACD_med"]) else 0,
            "macd_med_signal": (
                float(latest["MACD_med_signal"]) if not pd.isna(latest["MACD_med_signal"]) else 0
            ),
            "macd_med_diff": (
                float(latest["MACD_med_diff"]) if not pd.isna(latest["MACD_med_diff"]) else 0
            ),
            "macd_long": float(latest["MACD_long"]) if not pd.isna(latest["MACD_long"]) else 0,
            "macd_long_signal": (
                float(latest["MACD_long_signal"]) if not pd.isna(latest["MACD_long_signal"]) else 0
            ),
            "macd_long_diff": (
                float(latest["MACD_long_diff"]) if not pd.isna(latest["MACD_long_diff"]) else 0
            ),
            "short_trend": short_trend,
            "med_trend": med_trend,
            "long_trend": long_trend,
            "signal": signal,
            "history": df[["Close"]].tail(get_period_days(period)).to_dict("list"),
        }
    except Exception as e:
        print(f"Error fetching data for {ticker}: {e}")
        return None


# Get news for ticker
def get_news(ticker):
    news_items = []

    try:
        stock = yf.Ticker(ticker)

        # Try getting news from yfinance
        try:
            news_data = stock.news
            if news_data and isinstance(news_data, list):
                print(f"Found {len(news_data)} news items for {ticker} via yfinance")

                for item in news_data[:10]:
                    try:
                        # Get timestamp
                        timestamp = int(datetime.now().timestamp())
                        if "providerPublishTime" in item:
                            timestamp = int(item["providerPublishTime"])

                        # Get title
                        title = item.get("title", "")
                        if not title:
                            continue

                        # Get publisher
                        publisher = "Unknown"
                        if "publisher" in item:
                            if isinstance(item["publisher"], dict):
                                publisher = item["publisher"].get("displayName", "Unknown")
                            else:
                                publisher = str(item["publisher"])

                        # Get link
                        link = item.get("link", f"https://finance.yahoo.com/quote/{ticker}/news")

                        news_items.append(
                            {
                                "title": title,
                                "link": link,
                                "publisher": publisher,
                                "published": timestamp,
                            }
                        )
                    except (KeyError, TypeError, AttributeError) as e:
                        logger.debug(f"Error processing news item: {e}")
                        continue
        except Exception as e:
            print(f"News fetch failed: {e}")

        # If that didn't work, try scraping the page
        if len(news_items) == 0:
            try:
                from bs4 import BeautifulSoup
                import requests as req

                # Scrape news page
                url = f"https://finance.yahoo.com/quote/{ticker}/news"
                headers = {"User-Agent": "Mozilla/5.0"}
                response = req.get(url, headers=headers, timeout=5)

                if response.status_code == 200:
                    soup = BeautifulSoup(response.content, "html.parser")
                    # Find news articles
                    articles = soup.find_all("h3", class_="Mb(5px)")[:10]

                    for article in articles:
                        try:
                            link_tag = article.find("a")
                            if link_tag:
                                title = link_tag.text.strip()
                                link = link_tag.get("href", "")
                                if link and not link.startswith("http"):
                                    link = "https://finance.yahoo.com" + link

                                news_items.append(
                                    {
                                        "title": title,
                                        "link": link,
                                        "publisher": "Yahoo Finance",
                                        "published": int(datetime.now().timestamp()),
                                    }
                                )
                        except (AttributeError, KeyError, TypeError):
                            continue

                    print(f"Scraped {len(news_items)} news items for {ticker}")
            except Exception as e:
                print(f"Scraping failed: {e}")

        # If still no news, return link to yahoo finance
        if len(news_items) == 0:
            news_items = [
                {
                    "title": f"Visit Yahoo Finance for latest news on {ticker}",
                    "link": f"https://finance.yahoo.com/quote/{ticker}/news",
                    "publisher": "Yahoo Finance",
                    "published": int(datetime.now().timestamp()),
                }
            ]

        return news_items

    except Exception as e:
        print(f"Error fetching news for {ticker}: {e}")
        return [
            {
                "title": f"View news for {ticker} on Yahoo Finance",
                "link": f"https://finance.yahoo.com/quote/{ticker}/news",
                "publisher": "Yahoo Finance",
                "published": int(datetime.now().timestamp()),
            }
        ]


# API routes
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/statistics")
def statistics():
    return render_template("statistics.html")


@app.route("/detail/<ticker>")
def detail(ticker):
    return render_template("detail.html", ticker=ticker)


@app.route("/api/holdings", methods=["GET"])
def get_holdings():
    conn = get_db()
    holdings = conn.execute("SELECT * FROM holdings ORDER BY id DESC").fetchall()
    conn.close()

    result = []
    for holding in holdings:
        holding_dict = dict(holding)

        # Get current stock data
        stock_data = get_stock_data(holding_dict["ticker"])

        if stock_data:
            holding_dict["name"] = stock_data["name"]
            holding_dict["current_price"] = stock_data["current_price"]
            holding_dict["week52_range"] = (
                f"${stock_data['week52_low']:.2f} - ${stock_data['week52_high']:.2f}"
            )
            holding_dict["signal"] = stock_data["signal"]
            holding_dict["short_trend"] = stock_data["short_trend"]
            holding_dict["med_trend"] = stock_data["med_trend"]
            holding_dict["long_trend"] = stock_data["long_trend"]

            # Calculate current value
            holding_dict["value"] = stock_data["current_price"] * holding_dict["shares"]

            # Entry value
            entry_value = holding_dict["entry_price"] * holding_dict["shares"]

            # P/L in dollars
            holding_dict["pl_dollar"] = holding_dict["value"] - entry_value

            # P/L in percent
            holding_dict["pl_percent"] = (
                ((holding_dict["value"] - entry_value) / entry_value) * 100
                if entry_value > 0
                else 0
            )

            # Price change percent
            pct_change = (
                (stock_data["current_price"] - holding_dict["entry_price"])
                / holding_dict["entry_price"]
            ) * 100
            holding_dict["pct_change"] = pct_change
        else:
            holding_dict["name"] = holding_dict["ticker"]
            holding_dict["current_price"] = 0
            holding_dict["week52_range"] = "N/A"
            holding_dict["signal"] = "Hold"
            holding_dict["short_trend"] = "N/A"
            holding_dict["med_trend"] = "N/A"
            holding_dict["long_trend"] = "N/A"
            holding_dict["pct_change"] = 0
            holding_dict["value"] = 0
            holding_dict["pl_dollar"] = 0
            holding_dict["pl_percent"] = 0

        result.append(holding_dict)

    return jsonify(result)


@app.route("/api/holdings", methods=["POST"])
def add_holding():
    """Add a new holding with validation."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate required fields
        required_fields = ["ticker", "add_date", "entry_price", "shares"]
        for field in required_fields:
            if field not in data or data[field] is None or data[field] == "":
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Validate and sanitize ticker
        ticker = sanitize_ticker(data["ticker"])

        # Validate numeric fields
        entry_price = validate_price(data["entry_price"], "Entry price")
        shares = validate_shares(data["shares"])
        accumulate_price = validate_price(data.get("accumulate_price"), "Accumulate price")
        first_trim_price = validate_price(data.get("first_trim_price"), "First trim price")
        second_trim_price = validate_price(data.get("second_trim_price"), "Second trim price")
        exit_price = validate_price(data.get("exit_price"), "Exit price")

        # Check ticker is valid with yfinance
        if not validate_ticker(ticker):
            return jsonify({"error": f"Invalid ticker symbol: {ticker}"}), 400
    except ValueError as e:
        logger.warning(f"Validation error in add_holding: {e}")
        return jsonify({"error": "Invalid input data"}), 400
    except Exception as e:
        logger.error(f"Unexpected error in add_holding: {e}", exc_info=True)
        return jsonify({"error": "An unexpected error occurred"}), 500

    try:
        conn = get_db()
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO holdings (
                ticker, type, add_date, entry_price, shares,
                review_date, review_factors, accumulate_price,
                first_trim_price, first_trim_percentage,
                second_trim_price, second_trim_percentage, exit_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                ticker,
                data.get("type"),
                data["add_date"],
                entry_price,
                shares,
                data.get("review_date"),
                data.get("review_factors"),
                accumulate_price,
                first_trim_price,
                data.get("first_trim_percentage"),
                second_trim_price,
                data.get("second_trim_percentage"),
                exit_price,
            ),
        )
        conn.commit()
        holding_id = c.lastrowid
        conn.close()
        logger.info(f"Holding added successfully: {ticker}")
        return jsonify({"id": holding_id, "message": "Holding added successfully"})
    except sqlite3.Error as e:
        logger.error(f"Database error in add_holding: {e}")
        return jsonify({"error": "Database error occurred"}), 500


@app.route("/api/holdings/<int:holding_id>", methods=["PUT"])
def update_holding(holding_id):
    data = request.json

    # Check ticker if it changed
    if "ticker" in data and not validate_ticker(data["ticker"]):
        return jsonify({"error": "Invalid ticker symbol"}), 400

    conn = get_db()
    c = conn.cursor()
    c.execute(
        """
        UPDATE holdings SET
            ticker = ?, type = ?, add_date = ?, entry_price = ?, shares = ?,
            review_date = ?, review_factors = ?, accumulate_price = ?,
            first_trim_price = ?, first_trim_percentage = ?,
            second_trim_price = ?, second_trim_percentage = ?, exit_price = ?
        WHERE id = ?
    """,
        (
            data["ticker"].upper(),
            data.get("type"),
            data["add_date"],
            data["entry_price"],
            data["shares"],
            data.get("review_date"),
            data.get("review_factors"),
            data.get("accumulate_price"),
            data.get("first_trim_price"),
            data.get("first_trim_percentage"),
            data.get("second_trim_price"),
            data.get("second_trim_percentage"),
            data.get("exit_price"),
            holding_id,
        ),
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Holding updated successfully"})


@app.route("/api/holdings/<int:holding_id>", methods=["DELETE"])
def delete_holding(holding_id):
    conn = get_db()
    conn.execute("DELETE FROM holdings WHERE id = ?", (holding_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Holding deleted successfully"})


@app.route("/api/holdings/clear", methods=["DELETE"])
def clear_all_holdings():
    conn = get_db()
    conn.execute("DELETE FROM holdings")
    conn.commit()
    conn.close()

    return jsonify({"message": "All holdings cleared successfully"})


@app.route("/api/stock/<ticker>", methods=["GET"])
def get_stock(ticker):
    period = request.args.get("period", "1y")  # Default to 1 year
    stock_data = get_stock_data(ticker, period)

    if stock_data:
        return jsonify(stock_data)
    else:
        return jsonify({"error": "Unable to fetch stock data"}), 404


@app.route("/api/news/<ticker>", methods=["GET"])
def get_ticker_news(ticker):
    news = get_news(ticker)
    return jsonify(news)


@app.route("/api/earnings/<ticker>", methods=["GET"])
def get_earnings_date(ticker):
    try:
        stock = yf.Ticker(ticker)
        calendar = stock.calendar

        if calendar is not None and not calendar.empty:
            # Get earnings date
            if "Earnings Date" in calendar.index:
                earnings_date = calendar.loc["Earnings Date"]
                if pd.notna(earnings_date):
                    # Get first value if it's a series
                    if isinstance(earnings_date, pd.Series):
                        earnings_date = earnings_date.iloc[0]

                    # Convert to timestamp
                    if isinstance(earnings_date, pd.Timestamp):
                        return jsonify({"date": int(earnings_date.timestamp()), "available": True})

        # Try getting from stock info
        info = stock.info
        if "earningsTimestamp" in info and info["earningsTimestamp"]:
            return jsonify({"date": info["earningsTimestamp"], "available": True})

        return jsonify({"available": False})
    except Exception as e:
        print(f"Error fetching earnings date for {ticker}: {e}")
        return jsonify({"available": False})


# Wishlist API
@app.route("/api/wishlist", methods=["GET"])
def get_wishlist():
    conn = get_db()
    wishlist = conn.execute("SELECT * FROM wishlist ORDER BY id DESC").fetchall()
    conn.close()

    result = []
    for item in wishlist:
        item_dict = dict(item)
        stock_data = get_stock_data(item_dict["ticker"])

        if stock_data:
            item_dict["name"] = stock_data["name"]
            item_dict["current_price"] = stock_data["current_price"]
            item_dict["week52_range"] = (
                f"${stock_data['week52_low']:.2f} - ${stock_data['week52_high']:.2f}"
            )
            item_dict["signal"] = stock_data["signal"]
            item_dict["short_trend"] = stock_data["short_trend"]
            item_dict["med_trend"] = stock_data["med_trend"]
            item_dict["long_trend"] = stock_data["long_trend"]
        else:
            item_dict["name"] = item_dict["ticker"]
            item_dict["current_price"] = 0
            item_dict["week52_range"] = "N/A"
            item_dict["signal"] = "Hold"
            item_dict["short_trend"] = "N/A"
            item_dict["med_trend"] = "N/A"
            item_dict["long_trend"] = "N/A"

        result.append(item_dict)

    return jsonify(result)


@app.route("/api/wishlist", methods=["POST"])
def add_to_wishlist():
    try:
        data = request.json

        if not data or "ticker" not in data:
            return jsonify({"error": "Ticker symbol is required"}), 400

        ticker = data["ticker"].upper().strip()

        if not ticker:
            return jsonify({"error": "Ticker symbol cannot be empty"}), 400

        # Check ticker is valid
        if not validate_ticker(ticker):
            return (
                jsonify(
                    {
                        "error": (
                            f"Invalid ticker symbol: {ticker}. "
                            "Please check the symbol and try again."
                        )
                    }
                ),
                400,
            )

        conn = None
        try:
            conn = get_db()
            c = conn.cursor()

            # Get values
            buy_price = data.get("buy_price")
            notes = data.get("notes", "") or ""

            # Set buy_price to None if missing or 0
            if buy_price is not None:
                try:
                    buy_price = float(buy_price)
                    if buy_price <= 0:
                        buy_price = None
                except (ValueError, TypeError):
                    buy_price = None

            c.execute(
                """
                INSERT INTO wishlist (ticker, buy_price, notes)
                VALUES (?, ?, ?)
            """,
                (ticker, buy_price, notes),
            )
            conn.commit()
            return jsonify({"success": True, "message": "Item added to wishlist"})
        except sqlite3.IntegrityError as e:
            error_msg = f"Ticker {ticker} is already in wishlist"
            print(f"IntegrityError: {error_msg}")
            return jsonify({"error": error_msg}), 400
        except sqlite3.Error as e:
            error_msg = f"Database error: {str(e)}"
            print(f"SQLite error adding wishlist item: {error_msg}")
            import traceback

            traceback.print_exc()
            return jsonify({"error": "Database error. Please check the server logs."}), 500
        except Exception:
            error_msg = "Unexpected error"
            print(f"Unexpected error adding wishlist item: {error_msg}")
            import traceback

            traceback.print_exc()
            return jsonify({"error": "Server error. Please check the server logs."}), 500
        finally:
            if conn:
                try:
                    conn.close()
                except sqlite3.Error as e:
                    logger.error(f"Error closing database connection: {e}")
    except Exception as e:
        print(f"Error in add_to_wishlist: {e}")
        import traceback

        traceback.print_exc()
        return jsonify({"error": "Server error. Please try again."}), 500


@app.route("/api/wishlist/<int:id>", methods=["PUT"])
def update_wishlist(id):
    data = request.json

    conn = get_db()
    c = conn.cursor()
    c.execute(
        """
        UPDATE wishlist 
        SET buy_price = ?, notes = ?
        WHERE id = ?
    """,
        (data.get("buy_price"), data.get("notes", ""), id),
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/wishlist/<int:id>", methods=["DELETE"])
def delete_from_wishlist(id):
    conn = get_db()
    conn.execute("DELETE FROM wishlist WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


if __name__ == "__main__":
    # Get configuration from environment variables
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    host = os.getenv("FLASK_HOST", "127.0.0.1")  # Default to localhost for security
    port = int(os.getenv("FLASK_PORT", "5001"))

    # Warning if debug mode is enabled
    if debug_mode:
        logger.warning("⚠️  DEBUG MODE IS ENABLED - DO NOT USE IN PRODUCTION!")

    logger.info(f"Starting Flask app on {host}:{port} (debug={debug_mode})")
    app.run(host=host, port=port, debug=debug_mode)
