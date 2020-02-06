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
      appreciationRate: 0,
      propertyTax: 2.57, // El Paso County Texas
      loanValue: 0,
      loanTerm: 0,
      loanRate: 0,
      loanPointRate: 0,
      pointsOffered: 0,
      closingCost: 0,
      additionalMonthlyFees: 0
    }
  }

  render() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#282c34', color: 'white', fontSize: 24, flex: 1 }}>
        <header style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontSize: 24, height: 150 }}>
          <h1>Home Investment Calculator</h1>
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
            <input name={'appreciationRate'} onChange={(ev) => this.setState({ appreciationRate: ev.target.value })}/>
          </div>

          <div>
            <label>Property Size</label>
            <input name={'propertySize'} onChange={(ev) => this.setState({ propertySize: ev.target.value })}/>
          </div>
        </div>
        
        <h3 style={ItemHeader}>Calculations</h3>
        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10%' }}>

          <p>ARV Value-Rent Ratio (2% Rule): {this.calculatePropertyRentRatio()}</p>
          <p>Property Value - ARV Difference: ($){this.calculatePropertyARVDifferenceMoney()}</p>
          <p>Property Value - ARV Difference: (%){this.calculatePropertyARVDifferencePercent()}</p>
          <p>Pre-ARV Price per sq.ft ${this.calculatePreARVSquareFootage()} per sq.ft</p>
          <p>ARV Price per sq.ft ${this.calculateARVSquareFootage()} per sq.ft</p>
          <p>Taxes - {this.calculateTaxAmount()}</p>

        </div>

        <h3 style={ItemHeader}>Home Appreciation (Market Value)</h3>

        <div style={Item}>
          <p>1 Year: ${this.calculateHomeAppreciation(1, this.state.propertyArvValue)}</p>
          <p>5 Years: ${this.calculateHomeAppreciation(5, this.state.propertyArvValue)}</p>
          <p>10 Years: ${this.calculateHomeAppreciation(10, this.state.propertyArvValue)}</p>
        </div>
        
        <h3 style={ItemHeader}>Rent Information</h3>
        <div style={Item}>
          <p>12 Months (Gross): ${this.calculateYearlyGrossRent()}</p>
          <p>6 Months (Gross): ${this.calculateYearlyGrossRent() / 2}</p>
          <p>3 Months (Gross): ${(this.calculateYearlyGrossRent() / 12) * 3}</p>
        </div>

        <h3 style={ItemHeader}>Ideal Renter Information</h3>

        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10%' }}>
          <p>Tenant Income - Rent/Income Ratio {this.calculateTenantIncomeRange()}</p>
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

        <div style={Item}>
          <div>
            <label>Closing Costs</label>
            <input name={'closingCost'} onChange={(ev) => this.setState({ closingCost: ev.target.value })}/>
          </div>

          <div>
            <label>Additional Monthly Fees (Taxes, Insurance, etc)</label>
            <input name={'additionalMonthlyFees'} onChange={(ev) => this.setState({ additionalMonthlyFees: ev.target.value })}/>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10%' }}>
          <p>Percent Values are against the value of the loan, not the home</p>
          <p>Down Payment: ${this.calculateMortgageDownPayment()}</p>
          <p>Down Payment: {this.calculateMortgagePercent()}%</p>
          <p>Mortgage Payment: ${this.calculateMonthlyFixedRatePayment(this.state.loanRate)}</p>
          <p>Monthly Payment: ${+this.calculateMonthlyFixedRatePayment(this.state.loanRate) + +this.state.additionalMonthlyFees}</p>
          <p>End of Term Total (Interest & Principal Only) : ${this.calculateTotalPaymentsBaseInterest()}</p>
          <p>Closing Cost: {this.calculateClosingCostPercent()}%</p>
          <p>Estimated Closing Cost Range (2-5%): {this.calculateClosingCostRange()}</p>
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

        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10%' }}>
          <p>Positive Cash Flow: ${this.calculateMonthlyPositiveCashFlow(this.state.rentValue)}</p>
          <p>Estimated property expenses (50% Rule): {this.calculateMonthlyPositiveCashFlow(this.state.rentValue) / 2} </p>
          <p>Yearly ROI (without overhead): {this.calculateCashFlowRateOfReturn(1)}%</p>
          <p>Yearly ROI (with 50% Rule): {this.calculateCashFlowRateOfReturn(0.5)}%</p>
          <p>Yearly ROI (with 25% Rule): {this.calculateCashFlowRateOfReturn(0.75)}%</p>
        </div>

        <h3 style={ItemHeader}>Cash Flow Over Time (without appreciation/inflation)</h3>

        <div style={Item}>
          <p>1 Year (Gross): ${this.calculatePositiveCashFlowForYear(1)}</p>
          <p>5 Years (Gross): ${this.calculatePositiveCashFlowForYear(5)}</p>
          <p>10 Years (Gross): ${this.calculatePositiveCashFlowForYear(10)}</p>
        </div>

        <div style={Item}>
          <p>15 Year (Gross): ${this.calculatePositiveCashFlowForYear(15)}</p>
          <p>20 Years (Gross): ${this.calculatePositiveCashFlowForYear(20)}</p>
          <p>30 Years (Gross): ${this.calculatePositiveCashFlowForYear(30)}</p>
        </div>

        <h3 style={ItemHeader}>Cash Flow Over Time (with {this.state.appreciationRate}% appreciation)</h3>

        <div style={Item}>
          <p>1 Years: ${this.calculatePositiveCashFlowWithAppreciation(1)}</p>
          <p>5 Years: ${this.calculatePositiveCashFlowWithAppreciation(5)}</p>
          {/* <p>10 Years: ${this.calculatePositiveCashFlowWithAppreciation(10)}</p> */}
        </div>

        <div style={Item}>
          {/* <p>15 Year: ${this.calculatePositiveCashFlowWithAppreciation(15)}</p>
          <p>20 Years: ${this.calculatePositiveCashFlowWithAppreciation(20)}</p>
          <p>30 Years: ${this.calculatePositiveCashFlowWithAppreciation(30)}</p> */}
        </div>
      </div>

      // Notes Section
      // Lender Credits - Adding lender credits increments loan interest amount
    );
  }

  calculatePropertyRentRatio() {
    const { rentValue, propertyArvValue } = this.state;
    const ratio = (rentValue / propertyArvValue) * 100;
    return ratio.toFixed(2);
  }

  calculatePropertyARVDifferenceMoney() {
    const { propertyValue, propertyArvValue } = this.state;
    const valueDifference = propertyArvValue - propertyValue;
    return valueDifference;
  }

  calculatePropertyARVDifferencePercent() {
    const { propertyValue, propertyArvValue } = this.state;
    const percentDifference = 100 - ((propertyValue/propertyArvValue) * 100);
    return percentDifference.toFixed(2);
  }

  calculatePreARVSquareFootage() {
    const { propertySize, propertyValue } = this.state;
    return (propertyValue / propertySize).toFixed(2);
  }

  calculateARVSquareFootage() {
    const { propertySize, propertyArvValue } = this.state;
    return (propertyArvValue / propertySize).toFixed(2);
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
    // P = L * c [ (1 + c)n] / [(1+c)n - 1]
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
    return totalPayments.toFixed(2);
  }

  calculateClosingCostPercent() {
    const { loanValue, closingCost } = this.state;

    const closingCostInPercent = (closingCost / loanValue) * 100;
    return closingCostInPercent.toFixed(2);
  }

  calculateClosingCostRange() {
    const { loanValue } = this.state;
    const onePercent = loanValue / 100;

    const twoPercent = onePercent * 2;
    const fivePercent = onePercent * 5;

    return `$${twoPercent} -- $${fivePercent}`;
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
    const yearsToBreakEven = (monthsToBreakEven / 12).toFixed(2);

    return `Savings - ${paymentSavings}/month, ${(paymentSavings * 12).toFixed(2)}/year. Break even in year(s): ${yearsToBreakEven}`;
  }

  calculateMonthlyPositiveCashFlow(rentValue) {
    const { loanRate, additionalMonthlyFees } = this.state;
    const cashFlow = rentValue - this.calculateMonthlyFixedRatePayment(loanRate) - additionalMonthlyFees;
    return cashFlow.toFixed(2);
  }

  calculateCashFlowRateOfReturn(surpriseExpenseRatio) { // 0.5, 0.25, 1, etc
    const yearlyCashFlow = (this.calculateMonthlyPositiveCashFlow(this.state.rentValue) * surpriseExpenseRatio) * 12;
    const moneyDown = +this.calculateMortgageDownPayment() + +this.state.closingCost;
    const roi = (yearlyCashFlow / moneyDown) * 100;

    return roi.toFixed(2);
  }

  calculatePositiveCashFlowForYear(years) {
    const oneYearCashFlow = this.calculateMonthlyPositiveCashFlow(this.state.rentValue) * 12;
    return (oneYearCashFlow * years).toFixed(2);
  }

  calculatePositiveCashFlowWithAppreciation(years) {
    const { propertyArvValue, rentValue } = this.state;

    let totalAppreciatedCashFlow = +this.calculateMonthlyPositiveCashFlow(rentValue) * 12;

    let lastYearHomeValue = +this.calculateHomeAppreciation(1, propertyArvValue);

    for (let year = 1; year < years; year++) {
      const homeAppreciationValue = this.calculateHomeAppreciation(year, lastYearHomeValue);
      const rent = (homeAppreciationValue / 100) * this.calculatePropertyRentRatio();
      const cashFlow = this.calculateMonthlyPositiveCashFlow(rent) * 12;
      
      // console.log(`Calculating appreciation for year #${year}`);
      totalAppreciatedCashFlow += +cashFlow;

      lastYearHomeValue = +homeAppreciationValue;
    }

    return totalAppreciatedCashFlow;
  }

  calculateHomeAppreciation(years, homeValue) {
    const { appreciationRate } = this.state;

    // Formula for compounding interest rate
    // A = P (1 + r/n)^nt
    const principal = homeValue;
    const interestRate = appreciationRate / 100;
    const repetitions = 1; // Interest only applied once
    const time = years;

    const firstComputation = 1 + (interestRate / repetitions);
    const finalAmount = principal * Math.pow(firstComputation, (repetitions * time));

    return finalAmount.toFixed(2);
  }

  calculateTenantIncomeRange() {
    const twentyFivePercentIncome = this.calculateYearlyGrossRent() * 4;
    const thirtyPercentIncome = this.calculateYearlyGrossRent() * 3.3;

    return (`25%: ${twentyFivePercentIncome} - 30%: ${thirtyPercentIncome}`);
  }
}
