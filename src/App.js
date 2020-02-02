import React, { Component } from 'react';

const Item = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-evenly'
}

const ItemHeader = {
  display: 'flex',
  alignSelf: 'center',
  justifyContent: 'center'
}

export default class App extends Component {
  constructor() {
    super();

    this.state = {
      propertyValue: 0.0,
      propertyArvValue: 0,
      rentValue: 0,
      propertySize: 0,
      propertyTax: 2.57, // El Paso County Texas
      loanValue: 0,
      loanTerm: 0,
      loanRate: 0,
      loanPointRate: 0,
      pointsOffered: 0
    }
  }

  render() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#282c34', color: 'white', fontSize: 24, flex: 1 }}>
        <header style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontSize: 24, height: 150 }}>
          <h1>BRRR: Buy, Rehab Rent, Refinance Calculator</h1>
        </header>

        <h4 style={ItemHeader}>Property Information</h4>

        <div style={Item}>
          <div>
            <label>Sale Price</label>
            <input name={'propertyValue'} onChange={(ev) => this.setState({ propertyValue: ev.target.value })}/>
          </div>

          <div>
            <label>ARV/Market Value</label>
            <input name={'arvValue'} onChange={(ev) => this.setState({ propertyArvValue: ev.target.value })}/>
          </div>

          <div>
            <label>State Tax</label>
            <input name={'rentValue'} placeholder={this.state.propertyTax} onChange={(ev) => this.setState({ propertyTax: ev.target.value })}/>
          </div>
        </div>

        <div style={Item}>
          <div>
            <label>Rent Apprx.</label>
            <input name={'rentValue'} onChange={(ev) => this.setState({ rentValue: ev.target.value })}/>
          </div>

          <div>
            <label>Annual Apprec.</label>
            <input name={'appreciationValue'}/>
          </div>

          <div>
            <label>Property Size</label>
            <input name={'propertySize'} onChange={(ev) => this.setState({ propertySize: ev.target.value })}/>
          </div>
        </div>
        
        <h3 style={ItemHeader}>Calculations</h3>
        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10%' }}>

          <p>ARV Value-Rent Ratio (2% Rule): {this.calculatePropertyRentRatio()}</p>
          <p>Estimated property expenses (50% Rule): {this.calculateMonthlyPropertyExpensesThroughRent()} </p>
          <p>Property Value - ARV Difference: ($){this.calculatePropertyARVDifferenceMoney()}</p>
          <p>Property Value - ARV Difference: (%){this.calculatePropertyARVDifferencePercent()}</p>
          <p>Pre-ARV Price per sq.ft ${this.calculatePreARVSquareFootage()} per sq.ft</p>
          <p>ARV Price per sq.ft ${this.calculateARVSquareFootage()} per sq.ft</p>
          <p>Taxes - {this.calculateTaxAmount()}</p>

        </div>
        
        <h3 style={ItemHeader}>Rent Information</h3>
        <div style={Item}>
          <p>12 Months (Gross): ${this.calculateYearlyGrossRent()}</p>
          <p>6 Months (Gross): ${this.calculateYearlyGrossRent() / 2}</p>
          <p>3 Months (Gross): ${(this.calculateYearlyGrossRent() / 12) * 3}</p>
        </div>
        
        <h3 style={ItemHeader}>Optimal Deals</h3>
        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10%' }}>
          <p>Rent 1-2% ${this.calculateOptimalRentRange()}</p>
        </div>

        <h4 style={ItemHeader}>Mortgage Payment Information</h4>

        <div style={Item}>
          <div>
            <label>Loan Amount</label>
            <input name={'loanValue'} onChange={(ev) => this.setState({ loanValue: ev.target.value })}/>
          </div>

          <div>
            <label>Loan Term (Years)</label>
            <input name={'loanTerm'} onChange={(ev) => this.setState({ loanTerm: ev.target.value })}/>
          </div>
          
          <div>
            <label>Fixed Rate</label>
            <input name={'loanRate'} onChange={(ev) => this.setState({ loanRate: ev.target.value })}/>
          </div>

        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10%' }}>
          <p>Down Payment: ${this.calculateMortgageDownPayment()}</p>
          <p>Down Payment: {this.calculateMortgagePercent()}%</p>
          <p>Monthly Mortgage Payment: ${this.calculateMonthlyFixedRatePayment(this.state.loanRate)}</p>
          <p>Total Payments: ${this.calculateTotalPaymentsBaseInterest()}</p>
        </div>

        <h4 style={ItemHeader}>Mortgage Points Information</h4>

        <div style={Item}>
          <div>
            <label>Loan Point Rate</label>
            <input name={'loanPointRate'} onChange={(ev) => this.setState({ loanPointRate: ev.target.value })}/>
          </div>

          <div>
            <label>Points Offered</label>
            <input name={'pointsOffered'} onChange={(ev) => this.setState({ pointsOffered: ev.target.value })}/>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10%' }}>
          <p>Cost for 1 point (1% of loan ammount): ${this.calculateMortgagePointValue()}</p>
          <p>Points Payoff: ${this.calculateMortgagePointValue() * this.state.pointsOffered}</p>
          <p>Breaking Even - {this.calculatePointsBreakEven()}</p>
          <p>Monthly Mortgage Payment: ${this.calculateMonthlyFixedRatePayment(this.state.loanPointRate)}</p>
          <p>Total Payments: ${this.calculateTotalPaymentsPointInterest()}</p>
          <p>Base/Point Interest Savings: ${(this.calculateTotalPaymentsBaseInterest() - this.calculateTotalPaymentsPointInterest()).toFixed(2)}</p>
        </div>

        <h4 style={ItemHeader}>Cash Flow</h4>
      </div>
    );
  }

  calculatePropertyRentRatio() {
    const { rentValue, propertyArvValue } = this.state;
    const ratio = (rentValue / propertyArvValue) * 100;
    return ratio;
  }

  calculateMonthlyPropertyExpensesThroughRent() {
    const monthlyPropertyExpenses = this.state.rentValue / 2;
    return monthlyPropertyExpenses;
  }

  calculatePropertyARVDifferenceMoney() {
    const { propertyValue, propertyArvValue } = this.state;
    const valueDifference = propertyArvValue - propertyValue;
    return valueDifference;
  }

  calculatePropertyARVDifferencePercent() {
    const { propertyValue, propertyArvValue } = this.state;
    const percentDifference = 100 - ((propertyValue/propertyArvValue) * 100);
    return percentDifference;
  }

  calculatePreARVSquareFootage() {
    const { propertySize, propertyValue } = this.state;
    return propertyValue / propertySize;
  }

  calculateARVSquareFootage() {
    const { propertySize, propertyArvValue } = this.state;
    return propertyArvValue / propertySize;
  }

  calculateTaxAmount() {
    const { propertyValue, propertyArvValue, propertyTax } = this.state;

    const tax = propertyTax / 100;
    const propertyValuedTax = (propertyValue * tax).toFixed(2);
    const propertyARVValuedTax = (propertyArvValue  * tax).toFixed(2);

    return `Sale: ${propertyValuedTax}, ARV: ${propertyARVValuedTax}`;
  }

  calculateOptimalRentRange() {
    const onePercent = this.state.propertyArvValue / 100;

    return `${onePercent}-${onePercent * 2}`;
  }

  calculateYearlyGrossRent() {
    const yearlyRent = this.state.rentValue * 12; // 12 months
    return yearlyRent;
  }

  calculateYearlyNetRent() {
    const yearlyRent = (this.state.rentValue / 2) * 12; // 12 months
    return yearlyRent;
  }

  calculateMortgagePointValue() {
    const { loanValue } = this.state;
    const pointValue = loanValue / 100;
    return pointValue;
  }

  calculateMortgageDownPayment() {
    const { propertyValue, loanValue } = this.state;
    return propertyValue - loanValue;
  }

  calculateMortgagePercent() {
    const { propertyValue } = this.state;
    const mortgagePercent = (this.calculateMortgageDownPayment() / propertyValue) * 100;
    return mortgagePercent.toFixed(2);
  }

  calculateMonthlyFixedRatePayment(loanRate) {
    // P = L[c (1 + c)n] / [(1+c)n - 1]
    // L = Mortgage Amount (Principle)
    // c = Monthly Interest Rate (Yearly Rate / 12 months)
    // n = Loan term in months
    const { loanValue, loanTerm } = this.state;
    const principle = loanValue;
    const interest = loanRate / 100 / 12;
    const months = loanTerm * 12;

    const monthlyPayment = principle * interest * (Math.pow(1 + interest, months)) / (Math.pow(1 + interest, months) - 1)
    return monthlyPayment.toFixed(2);
  }

  calculateTotalPaymentsBaseInterest() {
    const { loanRate, loanTerm } = this.state;

    const months = loanTerm * 12;
    const totalPayments = this.calculateMonthlyFixedRatePayment(loanRate) * months;
    return totalPayments;
  }

  calculateTotalPaymentsPointInterest() {
    const { loanPointRate, loanTerm } = this.state;

    const months = loanTerm * 12;
    const totalPayments = this.calculateMonthlyFixedRatePayment(loanPointRate) * months;
    return totalPayments.toFixed(2);
  }

  calculatePointsBreakEven() {
    const { loanRate, loanPointRate } = this.state;
    
    const regularRatePayment = this.calculateMonthlyFixedRatePayment(loanRate);
    const pointRatePayment = this.calculateMonthlyFixedRatePayment(loanPointRate);

    const paymentSavings = (regularRatePayment - pointRatePayment).toFixed(2);
    const monthsToBreakEven = ((this.calculateMortgagePointValue() / paymentSavings) * this.state.pointsOffered);
    const yearsToBreakEven = (monthsToBreakEven / 12).toFixed(2)

    return `Payment savings: (month) ${paymentSavings} (year) ${(paymentSavings * 12).toFixed(2)}, Years: ${yearsToBreakEven}`;
  }
}
