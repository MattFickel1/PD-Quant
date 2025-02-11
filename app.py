# Work in progress. Comparative analysis @ Line 248 is currently hard coded. I will add proper functionality soon.

# Import necessary libraries and modules
from flask import Flask, render_template, request, jsonify
import requests
import pandas as pd
import sqlite3
import json
from datetime import datetime, timedelta

# Initialize Flask application
app = Flask(__name__)

# Create a cache dictionary to store company data
# Using a dictionary allows us to store both the data and when it was last updated
company_cache = {
    'data': None,
    'last_updated': None
}

def get_company_data():
    """
    Fetch and cache company lookup data from SEC.
    Implements caching to avoid hitting SEC's API too frequently.
    
    Returns:
        list: List of dictionaries containing company information
    """
    global company_cache
    
    # Check if we have valid cached data (less than 24 hours old)
    if (company_cache['data'] is not None and 
        company_cache['last_updated'] is not None and
        datetime.now() - company_cache['last_updated'] < timedelta(hours=24)):
        return company_cache['data']
    
    try:
        # Fetch fresh data from SEC
        url = 'https://www.sec.gov/files/company_tickers.json'
        headers = {
            'User-Agent': 'Sample Company Name AdminContact@company.com'
        }
        response = requests.get(url, headers=headers)
        data = response.json()
        
        # Convert the data structure for easier lookup
        companies = []
        for entry in data.values():
            companies.append({
                'cik_str': str(entry['cik_str']).zfill(10),  # Ensure CIK is 10 digits
                'ticker': entry['ticker'],
                'title': entry['title']
            })
        
        # Update cache with new data
        company_cache['data'] = companies
        company_cache['last_updated'] = datetime.now()
        return companies
        
    except Exception as e:
        print(f"Error fetching company data: {e}")
        # Return cached data if available, empty list if not
        return [] if company_cache['data'] is None else company_cache['data']

def build_sec_url(cik, accession):
    """
    Builds a direct link to the SEC filing
    Args:
        cik (str): Company CIK number
        accession (str): Filing accession number
    Returns:
        str: URL to the SEC filing
    """
    # Remove dashes from accession number as per SEC URL format
    clean_accession = accession.replace('-', '')
    
    # Build the URL using SEC's format
    return f"https://www.sec.gov/Archives/edgar/data/{cik}/{clean_accession}/{accession}.txt"

def fetch_sec_data(cik='320193'):
    """
    Fetch company filing data from SEC EDGAR
    Args:
        cik (str): Company's CIK number (Central Index Key)
    Returns:
        dict: JSON response from SEC
    """
    # Check if CIK is empty or None
    if not cik:
        print("No CIK provided, using default (Apple Inc.)")
        cik = '320193'  # Default to Apple Inc.

    url = f'https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json'
    headers = {
        'User-Agent': 'Sample Company Name AdminContact@company.com'
    }
    try:
        response = requests.get(url, headers=headers)
        # Check if the response was successful
        if response.status_code == 200:
            data = response.json()
            print("\nAvailable SEC data fields:", data.keys())
            print("\nAvailable filing fields:", data['filings']['recent'].keys())
            return data
        else:
            print(f"Error: Received status code {response.status_code} from SEC API")
            return None
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

def process_sec_data(data):
    """
    Convert SEC data into a pandas DataFrame with enhanced information
    Args:
        data (dict): JSON data from SEC
    Returns:
        pandas.DataFrame: Processed SEC filing data
    """
    if not data or 'filings' not in data:
        print("No filings data found")
        return pd.DataFrame()
    
    try:
        # Create the base DataFrame with comprehensive filing information
        filings = pd.DataFrame({
            'Form Type': data['filings']['recent']['form'],
            'Filing Date': data['filings']['recent']['filingDate'],
            'Report Date': data['filings']['recent']['reportDate'],
            'Document': data['filings']['recent']['primaryDocument'],
            'Description': data['filings']['recent']['primaryDocDescription'],
            'Size': data['filings']['recent']['size'],
            'Is XBRL': data['filings']['recent']['isXBRL'],
            'Accession': data['filings']['recent']['accessionNumber']
        })
        
        # Add direct links to SEC documents
        cik = str(data['cik']).zfill(10)
        filings['SEC URL'] = filings['Accession'].apply(
            lambda x: build_sec_url(cik, x)
        )
        
        return filings.head(10)  # Return the 10 most recent filings
        
    except Exception as e:
        print(f"Error processing SEC data: {e}")
        return pd.DataFrame()

def store_filings(df):
    """
    Store the processed filings in SQLite database
    Args:
        df (pandas.DataFrame): Processed SEC filing data
    """
    conn = sqlite3.connect('sec_data.db')
    df.to_sql('filings', conn, if_exists='replace', index=False)
    conn.close()

def get_stored_filings():
    """
    Retrieve stored filings from the database
    Returns:
        pandas.DataFrame: Stored filing data
    """
    conn = sqlite3.connect('sec_data.db')
    df = pd.read_sql('SELECT * FROM filings', conn)
    conn.close()
    return df

@app.route('/search_companies')
def search_companies():
    """
    Enhanced API endpoint for company search with smart ranking
    Returns:
        JSON: Ranked list of matching companies
    """
    query = request.args.get('query', '').lower()
    companies = get_company_data()
    
    if not query:
        return jsonify([])
        
    # Score and rank matches using a sophisticated ranking algorithm
    scored_matches = []
    for company in companies:
        score = 0
        title_lower = company['title'].lower()
        ticker_lower = company['ticker'].lower()
        
        # Exact matches get highest score
        if query == ticker_lower:
            score += 100
        elif query == title_lower:
            score += 90
            
        # Starts-with matches get next highest score
        elif ticker_lower.startswith(query):
            score += 80
        elif title_lower.startswith(query):
            score += 70
            
        # Contains matches get lower score
        elif query in ticker_lower:
            score += 60
        elif query in title_lower:
            score += 50
            
        # If we have any kind of match, add to results
        if score > 0:
            scored_matches.append({
                **company,
                'score': score,
                'matchType': 'ticker' if query in ticker_lower else 'name'
            })
    
    # Sort by score and take top 10 results
    sorted_matches = sorted(scored_matches, key=lambda x: x['score'], reverse=True)[:10]
    
    return jsonify(sorted_matches)

@app.route('/')
def index():
    # Get the search parameters
    cik = request.args.get('cik', '320193')
    company_name = request.args.get('company_name', '')
    
    # Fetch and process data
    raw_data = fetch_sec_data(cik)
    
    if raw_data:
        processed_data = process_sec_data(raw_data)
        store_filings(processed_data)
    
    # Get stored filings - notice we use 'filings' not 'filing'
    filings = get_stored_filings()
    filings_list = filings.to_dict('records')
    
    # Render template with all necessary data
    return render_template('index.html', 
                         filings=filings_list,  # This is the correct variable name
                         company_name=company_name)

# Comparative analysis of financials in detailed view``
@app.route('/filing_details/<accession>')
def get_filing_details(accession):
    print(f"Received request for filing details: {accession}")
    try:
        # Enhanced sample data with comparative analysis
        details = {
            'financials': {
                'Revenue': {
                    'current': 123456789,
                    'previous_year': 110234567,
                    'previous_quarter': 119876543,
                    'yoy_change': 12.0,
                    'qoq_change': 3.0
                },
                'Net Income': {
                    'current': 45678901,
                    'previous_year': 41234567,
                    'previous_quarter': 44567890,
                    'yoy_change': 10.8,
                    'qoq_change': 2.5
                },
                'Operating Cash Flow': {
                    'current': 34567890,
                    'previous_year': 31234567,
                    'previous_quarter': 33456789,
                    'yoy_change': 10.7,
                    'qoq_change': 3.3
                }
            },
            'industry_benchmarks': {
                'Profitability': {
                    'Operating Margin': {
                        'company': 22.3,
                        'industry_avg': 18.7,
                        'industry_high': 28.4,
                        'industry_low': 12.1,
                        'percentile': 75,  # Company is better than 75% of peers
                        'trend': 'improving'  # Can be 'improving', 'stable', or 'declining'
                    },
                    'Net Profit Margin': {
                        'company': 15.7,
                        'industry_avg': 12.4,
                        'industry_high': 20.1,
                        'industry_low': 8.2,
                        'percentile': 80,
                        'trend': 'stable'
                    }
                },
                'Efficiency': {
                    'Asset Turnover': {
                        'company': 0.85,
                        'industry_avg': 0.72,
                        'industry_high': 1.1,
                        'industry_low': 0.5,
                        'percentile': 70,
                        'trend': 'improving'
                    },
                    'Revenue per Employee': {
                        'company': 450000,
                        'industry_avg': 380000,
                        'industry_high': 520000,
                        'industry_low': 290000,
                        'percentile': 85,
                        'trend': 'stable'
                    }
                },
                'Growth': {
                    'Revenue Growth': {
                        'company': 12.0,
                        'industry_avg': 8.5,
                        'industry_high': 15.2,
                        'industry_low': 3.1,
                        'percentile': 78,
                        'trend': 'improving'
                    },
                    'Market Share Growth': {
                        'company': 2.3,
                        'industry_avg': 0.5,
                        'industry_high': 3.1,
                        'industry_low': -1.2,
                        'percentile': 85,
                        'trend': 'improving'
                    }
                }
            },
            'key_ratios': {
                'current': {
                    'PE Ratio': 25.4,
                    'Price to Book': 12.3,
                    'Debt to Equity': 0.45,
                    'Current Ratio': 2.1,
                    'Quick Ratio': 1.8
                },
                'historical': {
                    '1y_avg': {
                        'PE Ratio': 24.8,
                        'Price to Book': 11.9
                    },
                    '5y_avg': {
                        'PE Ratio': 23.5,
                        'Price to Book': 10.8
                    }
                }
            }
        }
        
        print("Returning enhanced details:", details)
        return jsonify(details)
        
    except Exception as e:
        print(f"Error fetching filing details: {e}")
        return jsonify({'error': 'Failed to fetch filing details'}), 500

# Run the application in debug mode if executed directly
if __name__ == '__main__':
    app.run(debug=True)
