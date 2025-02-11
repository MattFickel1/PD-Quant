// BEGINNING OF FUNCTIONS 

console.log('Javascript file loaded');

// #1. First, utility functions that other code will need.
// f.1: adds debounce to the site
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// f.2: add highlighting for matches in the autocomplete feature
function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// #2. Helper functions for filing details
// f.3: Filing Display Functions
function getFilingPurpose(formType) {
    // This helper function explains what each filing type means
    const purposes = {
        '10-K': 'Annual Report - Comprehensive overview of the company\'s business and financial condition',
        '10-Q': 'Quarterly Report - Overview of quarterly business and financial results',
        '8-K': 'Current Report - Notification of major events that shareholders should know about',
        '4': 'Statement of changes in beneficial ownership (insider trading)',
        // Add more form types as needed
    };
    return purposes[formType] || 'SEC Filing';
}

// f.4+1 - creates function to parse through financial data from various filings
function parseFinancialData(filingContent) {

    //more to come soon

}

// f.4: Create expandable row and detailed row functions for more detailed filing information
function createExpandableRow(filing) {
    // Create the main row w/ existing information
    const mainRow = document.createElement('tr');
    mainRow.innerHTML = `
        <td>
             <button class="expand-button" aria-label="Show details">+</button>
            <a href="${filing['SEC URL']}" target="_blank" class="filing-link">
                ${filing['Form Type']}
                <span class="link-icon">↗</span>
            </a>
        </td>
        <td>${filing['Filing Date']}</td>
        <td>${filing['Report Date']}</td>
        <td>${filing['Document']}</td>
        <td>${filing['Description']}</td>
        <td>${filing['Size']}</td>
        <td>
            <span class="badge badge-xbrl">
                ${filing['Is XBRL'] ? 'Yes' : 'No'}
            </span>
        </td>
    `;

    // Create the expandable details row
    const detailsRow = document.createElement('tr');
    detailsRow.className = 'filing-details';
    detailsRow.style.display = 'none';
    detailsRow.innerHTML = `
        <td colspan="7">
            <div class="filing-details-content">
                <div class="filing-summary">
                    <h4>Filing Summary</h4>
                    <p class="filing-purpose">${getFilingPurpose(filing['Form Type'])}</p>
                    <div class="key-points">Loading key points...</div>
                </div>
                <div class="financial-highlights">
                    <h4>Financial Highlights</h4>
                    <div class="highlights-content">Loading financial data...</div>
                </div>
            </div>
        </td>
    `;
    return {mainRow, detailsRow};
}

// f.5: creates function to handle row expansion
function setUpRowExpansion(mainRow, detailsRow, filing, filingDisplay) {
    const expandButton = mainRow.querySelector('.expand-button');

    // Toggle the details row visibility
    expandButton.addEventListener('click', () => {
        const isExpanded = detailsRow.style.display !== 'none';
        detailsRow.style.display = isExpanded ? 'none' : 'table-row';

        // Update the button text
        expandButton.textContent = isExpanded ? '+' : '-';
        
        // If we're expanding and haven't loaded the data yet, load it
        if (!isExpanded && !detailsRow.dataset.loaded) {
            filingDisplay.loadFilingDetails(detailsRow, filing);
            detailsRow.dataset.loaded = 'true';
        }
    });
}

// #3. Class definititions - each builds on the functionality of the previous ones 

// Loading manager handles the loading overlay
class LoadingManager {
    constructor() {
        this.overlay = document.querySelector('.loading-overlay');
        // Hide loading overlay initially
        this.hide();
    }

    show(message = 'Fetching SEC Filings...') {
        this.overlay.querySelector('.loading-text').textContent = message;
        this.overlay.classList.add('active');
    }

    hide() {
        this.overlay.classList.remove('active');
    }
}

// Search functionality + all required methods
class AutocompleteSearch {
    constructor() {
        // Initial checkpoint - class creation
        console.log('===== AutocompleteSearch Initialization =====');
        
        // Element finding checkpoint
        const searchInput = document.getElementById('company-search');
        const suggestionsList = document.getElementById('suggestions');
        const searchForm = document.getElementById('search-form');
        const cikInput = document.getElementById('cik-input');
        
        console.log('Found Elements:', {
            searchInput: !!searchInput,
            suggestionsList: !!suggestionsList,
            searchForm: !!searchForm,
            cikInput: !!cikInput
        });

        // Initialize our elements
        this.searchInput = searchInput;
        this.suggestionsList = suggestionsList;
        this.searchForm = searchForm;
        this.cikInput = cikInput;
        
        // Keep track of the current state of our suggestions
        this.selectedIndex = -1;      // No suggestion selected initially
        this.suggestions = [];        // Empty array to store matching companies
        this.isLoading = false;      // Track if we're currently fetching results

        // Set up all our event listeners checkpoint
        console.log('Setting up event listeners...');
        this.setupEventListeners();
        console.log('Event listeners setup complete');
    }

    setupEventListeners() {
        // Input event listener checkpoint
        this.searchInput.addEventListener('input', debounce((e) => {
            console.log('Input event triggered with value:', e.target.value);
            this.performSearch(e.target.value);
        }, 300));

        // Form submission checkpoint
        this.searchForm.addEventListener('submit', (e) => {
            console.log('Form submission attempted');
            if (!this.cikInput.value) {
                console.log('Preventing submission - no CIK value');
                e.preventDefault();
                alert('Please select a company from the suggestions');
                return;
            }
            console.log('Form submitting with CIK:', this.cikInput.value);
        });

        // Handle keyboard navigation through suggestions
        this.searchInput.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.moveSelection(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.moveSelection(-1);
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.selectCurrent();
                    break;
                case 'Escape':
                    this.clearSuggestions();
                    break;
            }
        });
    }

    async performSearch(query) {
        console.log('Performing search for:', query); // Debug Log
        if (query.length < 2) {
            this.clearSuggestions();
            return;
        }

        this.showLoading();

        try {
            const response = await fetch(`/search_companies?query=${encodeURIComponent(query)}`);
            const companies = await response.json();
            
            this.suggestions = companies;
            this.selectedIndex = -1;
            
            if (companies.length === 0) {
                this.showNoResults();
            } else {
                this.displaySuggestions(companies, query);
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            this.showError();
        }
    }
    displaySuggestions(companies, query) {
        this.suggestionsList.innerHTML = companies.map((company, index) => `
            <div class="suggestion ${index === this.selectedIndex ? 'selected' : ''}" 
                 data-index="${index}"
                 data-cik="${company.cik_str}">
                <span class="suggestion-title">
                    ${highlightMatch(company.title, query)}
                </span>
                <span class="suggestion-ticker">
                    ${highlightMatch(company.ticker, query)}
                </span>
            </div>
        `).join('');

        // Add click handlers to each suggestion
        this.suggestionsList.querySelectorAll('.suggestion').forEach(div => {
            div.addEventListener('click', () => {
                const index = parseInt(div.dataset.index);
                this.selectSuggestion(index);
            });

            div.addEventListener('mouseover', () => {
                this.selectedIndex = parseInt(div.dataset.index);
                this.updateSelection();
            });
        });
    }
    moveSelection(change) {
        const newIndex = this.selectedIndex + change;
        if (newIndex >= -1 && newIndex < this.suggestions.length) {
            this.selectedIndex = newIndex;
            this.updateSelection();
        }
    }
    updateSelection() {
        this.suggestionsList.querySelectorAll('.suggestion').forEach((div, index) => {
            div.classList.toggle('selected', index === this.selectedIndex);
        });
    }
    selectCurrent() {
        if (this.selectedIndex >= 0) {
            this.selectSuggestion(this.selectedIndex);
        }
    }
    selectSuggestion(index) {
        const company = this.suggestions[index];
        
        // Update the search input and CIK value
        this.searchInput.value = company.title;
        this.cikInput.value = company.cik_str;
        
        // Add the company name as a hidden input for the server
        let companyNameInput = document.getElementById('company_name_input');
        if (!companyNameInput) {
            companyNameInput = document.createElement('input');
            companyNameInput.type = 'hidden';
            companyNameInput.name = 'company_name';
            companyNameInput.id = 'company_name_input';
            this.searchForm.appendChild(companyNameInput);
        }
        companyNameInput.value = company.title;
        
        // Clear suggestions and submit the form
        this.clearSuggestions();
        this.searchForm.submit();
    }
    clearSuggestions() {
        this.suggestionsList.innerHTML = '';
        this.suggestions = [];
        this.selectedIndex = -1;
    }
    showLoading() {
        this.suggestionsList.innerHTML = `
            <div class="loading-indicator">
                Searching...
            </div>
        `;
    }
    showNoResults() {
        this.suggestionsList.innerHTML = `
            <div class="no-results">
                No companies found
            </div>
        `;
    }

    showError() {
        this.sugguestionsList.innerHTML = `
            <div class="no-results">
                Error fetching results. Please try again.
            </div>
        `;}
}


//Filing Filter Code
// Filtering functionality 
class FilingFilter {
    constructor() {
        // Get all our filter buttons and the table body
        this.buttons = document.querySelectorAll('.filter-button');
        this.tableBody = document.querySelector('table tbody');
        this.setupEventListeners();
        
        // Store original table data for quick unfiltering
        this.allRows = Array.from(this.tableBody.getElementsByTagName('tr'));
    }

    setupEventListeners() {
        // Add click handlers to all filter buttons
        this.buttons.forEach(button => {
            button.addEventListener('click', () => {
                this.handleFilter(button);
                this.updateActiveButton(button);
            });
        });
    }

    handleFilter(selectedButton) {
    const filterType = selectedButton.dataset.type;
    console.log('Button clicked - Filter type:', filterType);
    
    this.allRows.forEach((row, index) => {
        const formTypeLink = row.querySelector('td:first-child a');
        
        // Check if we found the link element
        if (!formTypeLink) {
            console.log(`Row ${index}: Could not find filing type link`);
            return;
        }
        
        const formType = formTypeLink.textContent.replace('↗', '').trim();
        console.log(`Row ${index}: Found filing type "${formType}"`);
        
        if (filterType === 'all') {
            row.style.display = '';
            console.log(`Row ${index}: Showing (all filter)`);
        } else if (formType.includes(filterType)) {
            row.style.display = '';
            console.log(`Row ${index}: Showing (matches filter)`);
        } else {
            row.style.display = 'none';
            console.log(`Row ${index}: Hiding (doesn't match filter)`);
        }
    });
}

    updateActiveButton(selectedButton) {
        // Remove active class from all buttons
        this.buttons.forEach(button => button.classList.remove('active'));
        // Add active class to selected button
        selectedButton.classList.add('active');
    }
}

// Detailed display functionality
class FilingDisplay {
    constructor(tableBody) {
        this.tableBody = tableBody;
        this.loadingManager = new LoadingManager();
        this.setupRowExpansion();
    }

    // Method to handle expanding/collapsing rows and loading details
    setupRowExpansion() {
        this.tableBody.querySelectorAll('.filing-row').forEach(row => {
            row.addEventListener('click', () => {
                const detailsRow = row.nextElementSibling;
                // Check if this is a details row and handle visibility
                if (detailsRow && detailsRow.classList.contains('filing-details-row')) {
                    const isExpanded = detailsRow.style.display !== 'none';
                    detailsRow.style.display = isExpanded ? 'none' : 'table-row';
                    
                    // Only load details if we're expanding and haven't loaded them before
                    if (!isExpanded && !detailsRow.dataset.loaded) {
                        // Get the accession number from the main row's data attribute
                        const accession = row.dataset.accession;
                        this.loadFilingDetails(detailsRow, accession);
                        detailsRow.dataset.loaded = 'true';
                    }
                }
            });
        });
    }

    // Updated method to load filing details into our new three-section layout
    async loadFilingDetails(detailsRow, accession) {
        try {
            console.log('Starting to load details for accession:', accession);
            
            // Show loading state in each section
            ['financial-overview', 'kpi-metrics', 'growth-metrics'].forEach(section => {
                const element = detailsRow.querySelector(`#${section}-${accession}`);
                console.log(`Looking for element: #${section}-${accession}`, element); // Debug log
                if (element) {
                    element.innerHTML = `
                        <div class="loading-details">
                            <div class="loading-spinner"></div>
                            <div>Loading ${section.replace('-', ' ')}...</div>
                        </div>
                    `;
                }
            });
    
            // Fetch data
            const response = await fetch(`/filing_details/${accession}`);
            if (!response.ok) {
                throw new Error('Failed to fetch filing details');
            }
            const details = await response.json();
            console.log('Successfully fetched details:', details); // Debug log
    
            // Financial Metrics Overview
            const financialSection = detailsRow.querySelector(`#financial-overview-${accession}`);
            if (financialSection) {
                console.log('Updating financial section');
                financialSection.innerHTML = this.formatFinancialMetrics(details.financials);
            }
            
            // Industry benchmarks
            const benchmarkSection = detailsRow.querySelector(`#kpi-metrics-${accession}`);
            if (benchmarkSection) {
                console.log('Updating benchmark section');
                console.log('Benchmark data:', details.industry_benchmarks);
                const formattedBenchmarks = this.formatIndustryBenchmarks(details.industry_benchmarks);
                benchmarkSection.innerHTML = formattedBenchmarks;
            }
    
            // Growth Metrics
            const growthSection = detailsRow.querySelector(`#growth-metrics-${accession}`);
            if (growthSection) {
                console.log('Updating growth section');
                growthSection.innerHTML = this.formatGrowthMetrics(details.growth);
            }
    
        } catch (error) {
            console.error('Error in loadFilingDetails:', error); // Debug log
            // Show error message in each section
            ['financial-overview', 'kpi-metrics', 'growth-metrics'].forEach(section => {
                const element = detailsRow.querySelector(`#${section}-${accession}`);
                if (element) {
                    element.innerHTML = `
                        <div class="error-message">
                            <p>Sorry, we couldn't load ${section.replace('-', ' ')}.</p>
                            <p>Please try again later.</p>
                        </div>
                    `;
                }
            });
        }
    }

     // New method to update the Financial Overview section
     updateFinancialOverview(detailsRow, accession, details) {
        const element = detailsRow.querySelector(`#financial-overview-${accession}`);
        if (!element) return;

        element.innerHTML = this.formatFinancialMetrics(details.financials);
    }

    // New method to update the KPI section
    updateKPIMetrics(detailsRow, accession, details) {
        const element = detailsRow.querySelector(`#kpi-metrics-${accession}`);
        if (!element) return;

        element.innerHTML = this.formatKPIMetrics(details.kpis);
    }

    // New method to update the Growth Metrics section
    updateGrowthMetrics(detailsRow, accession, details) {
        const element = detailsRow.querySelector(`#growth-metrics-${accession}`);
        if (!element) return;

        element.innerHTML = this.formatGrowthMetrics(details.growth);
    }
    
    // Helper method to format key points from the filing
    formatKeyPoints(keyPoints) {
        if (!keyPoints || keyPoints.length === 0) {
            return '<p>No key points available for this filing.</p>';
        }

        return `
            <ul class="key-points-list">
                ${keyPoints.map(point => `<li>${point}</li>`).join('')}
            </ul>
        `;
    }

    // Helper method to format financial metrics
    // Add this method to your FilingDisplay class
    formatFinancialMetrics(financials) {
    if (!financials || Object.keys(financials).length === 0) {
        return '<p>No financial metrics available for this filing.</p>';
    }

    return Object.entries(financials)
        .map(([metric, data]) => `
            <div class="metric-group">
                <h5 class="metric-title">${metric}</h5>
                <div class="metric-row">
                    <span class="metric-label">Current:</span>
                    <span class="metric-value">${this.formatCurrency(data.current)}</span>
                </div>
                <div class="metric-row comparative">
                    <div class="comparison year">
                        <span class="label">Year-over-Year:</span>
                        <span class="value ${data.yoy_change >= 0 ? 'positive' : 'negative'}">
                            ${data.yoy_change >= 0 ? '↑' : '↓'} ${Math.abs(data.yoy_change)}%
                        </span>
                    </div>
                    <div class="comparison quarter">
                        <span class="label">Quarter-over-Quarter:</span>
                        <span class="value ${data.qoq_change >= 0 ? 'positive' : 'negative'}">
                            ${data.qoq_change >= 0 ? '↑' : '↓'} ${Math.abs(data.qoq_change)}%
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Add this method to your FilingDisplay class
    formatIndustryBenchmarks(benchmarks) {
        console.log('Formatting benchmarks:', benchmarks);  // Add this line
        if (!benchmarks || Object.keys(benchmarks).length === 0) {
            return '<p>No industry benchmark data available.</p>';
        }

        return Object.entries(benchmarks)
            .map(([category, metrics]) => `
                <div class="benchmark-category">
                    <h5 class="category-title">${category}</h5>
                    ${Object.entries(metrics).map(([metric, data]) => `
                        <div class="benchmark-metric">
                            <div class="metric-header">
                                <span class="metric-name">${metric}</span>
                                <span class="trend-indicator ${data.trend}">
                                    ${this.getTrendIcon(data.trend)}
                                </span>
                            </div>
                            
                            <div class="comparison-bar">
                                <div class="range-bar">
                                    <div class="industry-range" style="left: ${this.calculatePercentage(data.industry_low, data.industry_high, data.industry_low)}%; right: ${100 - this.calculatePercentage(data.industry_low, data.industry_high, data.industry_high)}%;">
                                    </div>
                                    <div class="company-marker" style="left: ${this.calculatePercentage(data.industry_low, data.industry_high, data.company)}%;">
                                    </div>
                                    <div class="industry-avg-marker" style="left: ${this.calculatePercentage(data.industry_low, data.industry_high, data.industry_avg)}%;">
                                    </div>
                                </div>
                            </div>
                            
                            <div class="metric-details">
                                <div class="company-value">
                                    Company: ${this.formatValue(data.company)}
                                </div>
                                <div class="industry-avg">
                                    Industry Avg: ${this.formatValue(data.industry_avg)}
                                </div>
                                <div class="percentile">
                                    Percentile: ${data.percentile}th
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('');
    }

    // Helper methods for the benchmark display
    getTrendIcon(trend) {
        const icons = {
            'improving': '↗',
            'stable': '→',
            'declining': '↘'
        };
        return icons[trend] || '→';
    }

    calculatePercentage(min, max, value) {
        return ((value - min) / (max - min) * 100).toFixed(1);
    }

    formatValue(value) {
        // Format based on the magnitude of the number
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `$${(value / 1000).toFixed(1)}K`;
        } else if (Number.isInteger(value)) {
            return value.toString();
        } else {
            return value.toFixed(2);
        }
    }    

    // Helper method to format currency values
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(value);
    }

    // Add new formatting methods for KPIs and Growth metrics
    formatKPIMetrics(kpis) {
        if (!kpis || Object.keys(kpis).length === 0) {
            return '<p>No KPI data available for this filing.</p>';
        }

        return Object.entries(kpis)
            .map(([metric, value]) => `
                <div class="metric-row">
                    <span class="metric-label">${metric}</span>
                    <span class="metric-value">${value}</span>
                </div>
            `).join('');
    }

    formatGrowthMetrics(growth) {
        if (!growth || Object.keys(growth).length === 0) {
            return '<p>No growth metrics available for this filing.</p>';
        }

        return Object.entries(growth)
            .map(([metric, value]) => `
                <div class="metric-row">
                    <span class="metric-label">${metric}</span>
                    <span class="metric-value">${value}%</span>
                </div>
            `).join('');
    }
    
}

// #4. Initialize code using all the above pieces, when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    // New logging checkpoints
    console.log('DOM Content Loaded - Creating AutocompleteSearch instance');
    
    // Your existing initialization code
    const loadingManager = new LoadingManager();
    const autocomplete = new AutocompleteSearch();
    const filingFilter = new FilingFilter();
    const filingDisplay = new FilingDisplay(document.querySelector('table tbody'));
    // Check if we're showing results from a search
    const urlParams = new URLSearchParams(window.location.search);
    const cik = urlParams.get('cik');
    const companyName = document.getElementById('company-search').value;

    if (cik && companyName) {
        const statusElement = document.getElementById('search-status');
        statusElement.textContent = 'Showing resultsfor "${companyName}"';
        statusElement.classList.add('active');
    }

    // Set up form submission handling
    document.getElementById('search-form').addEventListener('submit', function(e) {
        const cikInput = document.getElementById('cik-input');
        // Validate that we have a cik value
        if (!cikInput.value) {
            e.preventDefault();
            alert('Please select a company from the suggestions');
            return;
        }
        
        loadingManager.show();
    });

    // Final checkpoint
    console.log('AutocompleteSearch instance created and all components initialized');
});