from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR, DECIMAL, Date, DateTime, Enum, ForeignKey, Integer,
    SmallInteger, String, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Instrument(Base):
    __tablename__ = "instruments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    sector: Mapped[str] = mapped_column(String(64), nullable=False)
    exchange: Mapped[str] = mapped_column(String(32), nullable=False)
    isin: Mapped[str] = mapped_column(CHAR(12), unique=True, nullable=False)
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False, default="USD")
    market: Mapped[str] = mapped_column(Enum("foreign", "domestic"), nullable=False, default="foreign")
    weight_pct: Mapped[Decimal] = mapped_column(DECIMAL(6, 3), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    price: Mapped["Price"] = relationship(back_populates="instrument", uselist=False)
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="instrument")


class Broker(Base):
    __tablename__ = "brokers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    country: Mapped[str] = mapped_column(CHAR(2), nullable=False, default="MX")

    accounts: Mapped[list["Account"]] = relationship(back_populates="broker")


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (UniqueConstraint("broker_id", "number", name="uq_accounts_broker_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    broker_id: Mapped[int] = mapped_column(ForeignKey("brokers.id"), nullable=False)
    number: Mapped[str] = mapped_column(String(64), nullable=False)
    owner: Mapped[str] = mapped_column(String(128), nullable=False, default="PRIMARY")

    broker: Mapped["Broker"] = relationship(back_populates="accounts")


class Price(Base):
    __tablename__ = "prices"

    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id", ondelete="CASCADE"), primary_key=True)
    last_usd: Mapped[Decimal] = mapped_column(DECIMAL(14, 4), nullable=False)
    day_pct: Mapped[Decimal] = mapped_column(DECIMAL(6, 3), nullable=False, default=0)
    as_of: Mapped[date] = mapped_column(Date, nullable=False)

    instrument: Mapped["Instrument"] = relationship(back_populates="price")


class FxRate(Base):
    __tablename__ = "fx_rates"

    pair: Mapped[str] = mapped_column(String(7), primary_key=True)
    as_of: Mapped[date] = mapped_column(Date, primary_key=True)
    rate: Mapped[Decimal] = mapped_column(DECIMAL(12, 6), nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    type: Mapped[str] = mapped_column(Enum("BUY", "SELL", "DIV"), nullable=False)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), nullable=False)
    account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    qty: Mapped[Decimal] = mapped_column(DECIMAL(18, 6), nullable=False)
    price_usd: Mapped[Decimal] = mapped_column(DECIMAL(14, 4), nullable=False)
    fx_rate: Mapped[Decimal] = mapped_column(DECIMAL(12, 6), nullable=False)
    commission_pct: Mapped[Decimal] = mapped_column(DECIMAL(8, 6), nullable=False, default=0)
    iva_pct: Mapped[Decimal] = mapped_column(DECIMAL(6, 4), nullable=False, default=0)
    fees_mxn: Mapped[Decimal] = mapped_column(DECIMAL(14, 2), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    instrument: Mapped["Instrument"] = relationship(back_populates="transactions")
    account: Mapped["Account | None"] = relationship()


class RealizedLot(Base):
    __tablename__ = "realized_lots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), nullable=False)
    open_tx_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id"), nullable=True)
    close_tx_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id"), nullable=True)
    open_date: Mapped[date] = mapped_column(Date, nullable=False)
    close_date: Mapped[date] = mapped_column(Date, nullable=False)
    qty: Mapped[Decimal] = mapped_column(DECIMAL(18, 6), nullable=False)
    proceeds_mxn: Mapped[Decimal] = mapped_column(DECIMAL(16, 2), nullable=False)
    cost_mxn: Mapped[Decimal] = mapped_column(DECIMAL(16, 2), nullable=False)
    gain_mxn: Mapped[Decimal] = mapped_column(DECIMAL(16, 2), nullable=False)
    holding_days: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(Enum("short", "long"), nullable=False)
    market: Mapped[str] = mapped_column(Enum("foreign", "domestic"), nullable=False, default="foreign")

    instrument: Mapped["Instrument"] = relationship()


class TaxSetting(Base):
    __tablename__ = "tax_settings"

    fiscal_year: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    rate_applied: Mapped[Decimal] = mapped_column(DECIMAL(5, 4), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)


class LossCarryForward(Base):
    __tablename__ = "loss_carry_forward"

    origin_year: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    loss_mxn: Mapped[Decimal] = mapped_column(DECIMAL(16, 2), nullable=False)
    used_mxn: Mapped[Decimal] = mapped_column(DECIMAL(16, 2), nullable=False, default=0)
    expires_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
