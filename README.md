# Property Affordability Checker

A small React + Vite application for estimating property purchase affordability.

This app helps you compare purchase costs, financing needs, available cash, and whether an offer is affordable based on your inputs.

## Features

- Enter property valuation, asking price, offer amount, available cash, existing mortgage details, renovations, and fees
- See calculated mortgage requirement, total acquisition cost, monthly repayment estimate, and affordability summary
- Save input values in local storage so data is preserved while using the app

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Start the development server:
   `npm run dev`
3. Open the app in your browser at the local address shown by Vite

## Build for Production

- `npm run build`
- `npm run preview`

## Notes

- No external AI or Google-specific service configuration is required to run this app locally.
- If you want to clear saved input values, remove them from your browser local storage or refresh the app after resetting the form.
