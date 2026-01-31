# Database Schema Design

This document describes the database design for the LightWise system, including how real-time data and summarized data are stored and accessed.

## DynamoDB (Real-Time Data)

DynamoDB is used to store live data coming from streetlights, such as sensor readings and events.

This data includes:
- streetlight ID
- timestamp
- sensor values
- event type

## SQL Database (Summary Data)

The SQL database is used to store summarized data such as daily or hourly summaries from the streetlights. This data is mainly used for reports and dashboard views.

## Data Flow

Data is sent from streetlight devices through the API and processed by AWS Lambda. Real-time data is stored in DynamoDB, and summarized data is later stored in the SQL database. The frontend dashboard reads data mainly from the SQL database.
