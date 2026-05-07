-- =============================================================
-- FinanceStocks — MySQL schema
-- =============================================================
-- Currency model: prices stored in instrument's native currency
--   (usually USD or MXN); fees stored in MXN; fx_rate captures
--   the USD→MXN rate at trade time.
-- All monetary columns use DECIMAL to avoid binary-float drift.
-- =============================================================

CREATE DATABASE IF NOT EXISTS pepe_finance
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pepe_finance;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS realized_lots;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS prices;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS brokers;
DROP TABLE IF EXISTS instruments;
DROP TABLE IF EXISTS fx_rates;
DROP TABLE IF EXISTS loss_carry_forward;
DROP TABLE IF EXISTS tax_settings;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------
-- Reference data
-- ----------------------------------------------------------------

CREATE TABLE instruments (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticker       VARCHAR(16)  NOT NULL,
  name         VARCHAR(128) NOT NULL,
  sector       VARCHAR(64)  NOT NULL,
  exchange     VARCHAR(32)  NOT NULL,
  isin         CHAR(12)     NOT NULL,
  currency     CHAR(3)      NOT NULL DEFAULT 'USD',
  market       ENUM('foreign','domestic') NOT NULL DEFAULT 'foreign',
  weight_pct   DECIMAL(6,3) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_instruments_ticker (ticker),
  UNIQUE KEY uq_instruments_isin (isin),
  KEY idx_instruments_sector (sector)
) ENGINE=InnoDB;

CREATE TABLE brokers (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code      VARCHAR(32)  NOT NULL,
  name      VARCHAR(128) NOT NULL,
  country   CHAR(2)      NOT NULL DEFAULT 'MX',
  PRIMARY KEY (id),
  UNIQUE KEY uq_brokers_code (code)
) ENGINE=InnoDB;

CREATE TABLE accounts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  broker_id  INT UNSIGNED NOT NULL,
  number     VARCHAR(64)  NOT NULL,
  owner      VARCHAR(128) NOT NULL DEFAULT 'PRIMARY',
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_broker_number (broker_id, number),
  CONSTRAINT fk_accounts_broker FOREIGN KEY (broker_id) REFERENCES brokers(id)
) ENGINE=InnoDB;

-- Latest known market price per instrument (one row per ticker).
CREATE TABLE prices (
  instrument_id INT UNSIGNED  NOT NULL,
  last_usd      DECIMAL(14,4) NOT NULL,
  day_pct       DECIMAL(6,3)  NOT NULL DEFAULT 0,
  as_of         DATE          NOT NULL,
  PRIMARY KEY (instrument_id),
  CONSTRAINT fk_prices_instrument FOREIGN KEY (instrument_id) REFERENCES instruments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE fx_rates (
  pair      VARCHAR(7)    NOT NULL,    -- e.g. 'USD/MXN'
  as_of     DATE          NOT NULL,
  rate      DECIMAL(12,6) NOT NULL,
  PRIMARY KEY (pair, as_of)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- Trade activity
-- ----------------------------------------------------------------

CREATE TABLE transactions (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  external_id     VARCHAR(32)  NOT NULL,
  trade_date      DATE         NOT NULL,
  type            ENUM('BUY','SELL','DIV') NOT NULL,
  instrument_id   INT UNSIGNED NOT NULL,
  account_id      INT UNSIGNED NULL,
  qty             DECIMAL(18,6) NOT NULL,
  price_usd       DECIMAL(14,4) NOT NULL,
  fx_rate         DECIMAL(12,6) NOT NULL,
  commission_pct  DECIMAL(8,6) NOT NULL DEFAULT 0,
  iva_pct         DECIMAL(6,4) NOT NULL DEFAULT 0,
  fees_mxn        DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes           VARCHAR(255) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_external_id (external_id),
  KEY idx_transactions_trade_date (trade_date),
  KEY idx_transactions_instrument_date (instrument_id, trade_date),
  KEY idx_transactions_type (type),
  CONSTRAINT fk_transactions_instrument FOREIGN KEY (instrument_id) REFERENCES instruments(id),
  CONSTRAINT fk_transactions_account    FOREIGN KEY (account_id)    REFERENCES accounts(id)
) ENGINE=InnoDB;

-- FIFO match output (precomputed for tax reporting).
CREATE TABLE realized_lots (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  instrument_id   INT UNSIGNED NOT NULL,
  open_tx_id      INT UNSIGNED NULL,
  close_tx_id     INT UNSIGNED NULL,
  open_date       DATE         NOT NULL,
  close_date      DATE         NOT NULL,
  qty             DECIMAL(18,6) NOT NULL,
  proceeds_mxn    DECIMAL(16,2) NOT NULL,
  cost_mxn        DECIMAL(16,2) NOT NULL,
  gain_mxn        DECIMAL(16,2) NOT NULL,
  holding_days    INT          NOT NULL,
  kind            ENUM('short','long') NOT NULL,
  market          ENUM('foreign','domestic') NOT NULL DEFAULT 'foreign',
  PRIMARY KEY (id),
  KEY idx_realized_close_date (close_date),
  KEY idx_realized_instrument (instrument_id),
  CONSTRAINT fk_realized_instrument FOREIGN KEY (instrument_id) REFERENCES instruments(id),
  CONSTRAINT fk_realized_open_tx    FOREIGN KEY (open_tx_id)    REFERENCES transactions(id) ON DELETE SET NULL,
  CONSTRAINT fk_realized_close_tx   FOREIGN KEY (close_tx_id)   REFERENCES transactions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- Tax
-- ----------------------------------------------------------------

CREATE TABLE tax_settings (
  fiscal_year   YEAR          NOT NULL,
  rate_applied  DECIMAL(5,4)  NOT NULL,
  notes         VARCHAR(255)  NULL,
  PRIMARY KEY (fiscal_year)
) ENGINE=InnoDB;

CREATE TABLE loss_carry_forward (
  origin_year  YEAR          NOT NULL,
  loss_mxn     DECIMAL(16,2) NOT NULL,
  used_mxn     DECIMAL(16,2) NOT NULL DEFAULT 0,
  expires_year YEAR          NOT NULL,
  PRIMARY KEY (origin_year)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------
-- Seed data
-- ----------------------------------------------------------------

INSERT INTO instruments (ticker, name, sector, exchange, isin, currency, market, weight_pct) VALUES
  ('AAPL',   'Apple Inc.',                'Technology',     'NASDAQ',   'US0378331005', 'USD', 'foreign', 18.4),
  ('MSFT',   'Microsoft Corp.',           'Technology',     'NASDAQ',   'US5949181045', 'USD', 'foreign', 16.1),
  ('NVDA',   'NVIDIA Corp.',              'Semiconductors', 'NASDAQ',   'US67066G1040', 'USD', 'foreign', 15.8),
  ('AMZN',   'Amazon.com Inc.',           'Consumer Disc.', 'NASDAQ',   'US0231351067', 'USD', 'foreign', 11.2),
  ('TSLA',   'Tesla Inc.',                'Automotive',     'NASDAQ',   'US88160R1014', 'USD', 'foreign',  8.9),
  ('WALMEX', 'Walmart de México',         'Consumer Stap.', 'BMV',      'MXP4948K1056', 'MXN', 'domestic', 6.4),
  ('GFNORTE','Grupo Financiero Banorte',  'Financials',     'BMV',      'MXP370711014', 'MXN', 'domestic', 6.0),
  ('META',   'Meta Platforms',            'Communication',  'NASDAQ',   'US30303M1027', 'USD', 'foreign',  6.7),
  ('GOOGL',  'Alphabet Inc. Class A',     'Communication',  'NASDAQ',   'US02079K3059', 'USD', 'foreign',  5.4),
  ('VOO',    'Vanguard S&P 500 ETF',      'ETF',            'NYSEARCA', 'US9229083632', 'USD', 'foreign',  5.1);

INSERT INTO brokers (code, name, country) VALUES
  ('GBM',    'GBM+',                  'MX'),
  ('KUS',    'Kuspit',                'MX'),
  ('BNT',    'Banorte Casa de Bolsa', 'MX'),
  ('ACT',    'Actinver',              'MX'),
  ('IBKR',   'Interactive Brokers',   'US');

INSERT INTO accounts (broker_id, number, owner) VALUES
  ((SELECT id FROM brokers WHERE code='GBM'), 'PERSONAL-001', 'PRIMARY'),
  ((SELECT id FROM brokers WHERE code='KUS'), 'KUS-7741',     'PRIMARY'),
  ((SELECT id FROM brokers WHERE code='BNT'), 'BNT-3320',     'PRIMARY');

INSERT INTO prices (instrument_id, last_usd, day_pct, as_of) VALUES
  ((SELECT id FROM instruments WHERE ticker='AAPL'),    214.32,  1.24, '2026-05-06'),
  ((SELECT id FROM instruments WHERE ticker='MSFT'),    438.90,  0.62, '2026-05-06'),
  ((SELECT id FROM instruments WHERE ticker='NVDA'),    952.40,  3.41, '2026-05-06'),
  ((SELECT id FROM instruments WHERE ticker='AMZN'),    198.70, -0.42, '2026-05-06'),
  ((SELECT id FROM instruments WHERE ticker='TSLA'),    192.10, -2.14, '2026-05-06'),
  ((SELECT id FROM instruments WHERE ticker='WALMEX'),    4.21,  0.18, '2026-05-06'),
  ((SELECT id FROM instruments WHERE ticker='GFNORTE'),   8.62, -0.84, '2026-05-06'),
  ((SELECT id FROM instruments WHERE ticker='META'),    512.40,  0.94, '2026-05-06'),
  ((SELECT id FROM instruments WHERE ticker='GOOGL'),   168.20, -0.12, '2026-05-06'),
  ((SELECT id FROM instruments WHERE ticker='VOO'),     521.80,  0.31, '2026-05-06');

INSERT INTO fx_rates (pair, as_of, rate) VALUES
  ('USD/MXN', '2026-05-06', 17.4200);

INSERT INTO transactions
  (external_id, trade_date, type, instrument_id, account_id, qty, price_usd, fx_rate, commission_pct, iva_pct, fees_mxn, notes)
VALUES
  ('TX-2840', '2026-05-04', 'BUY',  (SELECT id FROM instruments WHERE ticker='NVDA'),   (SELECT id FROM accounts WHERE number='PERSONAL-001'),   5, 942.30, 17.42, 0.0025, 0.16, 184.20, 'DCA mensual'),
  ('TX-2839', '2026-05-02', 'DIV',  (SELECT id FROM instruments WHERE ticker='AAPL'),   (SELECT id FROM accounts WHERE number='PERSONAL-001'),  45,   0.24, 17.40, 0,      0,      0.00, 'Dividendo Q2'),
  ('TX-2838', '2026-04-28', 'SELL', (SELECT id FROM instruments WHERE ticker='TSLA'),   (SELECT id FROM accounts WHERE number='KUS-7741'),      10, 204.50, 17.38, 0.0025, 0.16, 156.40, 'Toma parcial'),
  ('TX-2837', '2026-04-22', 'BUY',  (SELECT id FROM instruments WHERE ticker='VOO'),    (SELECT id FROM accounts WHERE number='PERSONAL-001'),   4, 514.20, 17.51, 0.0025, 0.16, 152.30, NULL),
  ('TX-2836', '2026-04-15', 'BUY',  (SELECT id FROM instruments WHERE ticker='WALMEX'), (SELECT id FROM accounts WHERE number='BNT-3320'),     100,   4.18, 17.62, 0.0020, 0.16,  84.10, NULL),
  ('TX-2835', '2026-04-10', 'SELL', (SELECT id FROM instruments WHERE ticker='META'),   (SELECT id FROM accounts WHERE number='PERSONAL-001'),   3, 498.80, 17.55, 0.0025, 0.16,  98.40, 'Rebalanceo'),
  ('TX-2834', '2026-04-03', 'BUY',  (SELECT id FROM instruments WHERE ticker='MSFT'),   (SELECT id FROM accounts WHERE number='PERSONAL-001'),   6, 421.40, 17.21, 0.0025, 0.16, 142.80, NULL),
  ('TX-2833', '2026-03-28', 'BUY',  (SELECT id FROM instruments WHERE ticker='GOOGL'),  (SELECT id FROM accounts WHERE number='KUS-7741'),       8, 158.90, 16.98, 0.0025, 0.16,  96.20, NULL),
  ('TX-2832', '2026-03-21', 'BUY',  (SELECT id FROM instruments WHERE ticker='AMZN'),   (SELECT id FROM accounts WHERE number='PERSONAL-001'),  10, 184.30, 16.84, 0.0025, 0.16, 124.50, 'DCA mensual'),
  ('TX-2831', '2026-03-15', 'SELL', (SELECT id FROM instruments WHERE ticker='AAPL'),   (SELECT id FROM accounts WHERE number='PERSONAL-001'),   5, 208.40, 16.91, 0.0025, 0.16,  84.20, NULL),
  ('TX-2830', '2026-03-08', 'BUY',  (SELECT id FROM instruments WHERE ticker='GFNORTE'),(SELECT id FROM accounts WHERE number='BNT-3320'),      50,   8.94, 16.72, 0.0020, 0.16,  64.10, NULL),
  ('TX-2829', '2026-02-28', 'BUY',  (SELECT id FROM instruments WHERE ticker='NVDA'),   (SELECT id FROM accounts WHERE number='PERSONAL-001'),   3, 788.40, 17.04, 0.0025, 0.16, 132.40, NULL),
  ('TX-2828', '2026-02-12', 'SELL', (SELECT id FROM instruments WHERE ticker='AMZN'),   (SELECT id FROM accounts WHERE number='PERSONAL-001'),   4, 178.20, 17.18, 0.0025, 0.16,  72.80, NULL),
  ('TX-2827', '2026-01-22', 'BUY',  (SELECT id FROM instruments WHERE ticker='TSLA'),   (SELECT id FROM accounts WHERE number='KUS-7741'),      10, 221.40, 17.45, 0.0025, 0.16, 162.40, NULL),
  ('TX-2826', '2026-01-08', 'BUY',  (SELECT id FROM instruments WHERE ticker='MSFT'),   (SELECT id FROM accounts WHERE number='PERSONAL-001'),   4, 398.60, 17.62, 0.0025, 0.16, 124.20, 'Inicio de año');

INSERT INTO realized_lots (instrument_id, open_date, close_date, qty, proceeds_mxn, cost_mxn, gain_mxn, holding_days, kind, market) VALUES
  ((SELECT id FROM instruments WHERE ticker='TSLA'), '2025-09-12', '2026-04-28', 10, 35552.10, 41840.20, -6288.10, 228, 'long',  'foreign'),
  ((SELECT id FROM instruments WHERE ticker='META'), '2025-11-04', '2026-04-10',  3, 26243.20, 16312.40,  9930.80, 157, 'short', 'foreign'),
  ((SELECT id FROM instruments WHERE ticker='AAPL'), '2024-08-22', '2026-03-15',  5, 17616.40, 11824.00,  5792.40, 570, 'long',  'foreign'),
  ((SELECT id FROM instruments WHERE ticker='AMZN'), '2025-06-18', '2026-02-12',  4, 12243.60, 10184.10,  2059.50, 239, 'short', 'foreign');

INSERT INTO tax_settings (fiscal_year, rate_applied, notes) VALUES
  (2024, 0.30, 'Tasa marginal estimada ISR PF'),
  (2025, 0.30, 'Tasa marginal estimada ISR PF'),
  (2026, 0.30, 'Tasa marginal estimada ISR PF');

INSERT INTO loss_carry_forward (origin_year, loss_mxn, used_mxn, expires_year) VALUES
  (2024, 4520.30, 1679.80, 2034),
  (2025, 1284.10,    0.00, 2035),
  (2026, 6288.10, 6288.10, 2036);
