# RAG System Test Queries

## 🎯 Difficult Test Queries for RAG Evaluation

### 1. **Complex Multi-Part Questions**
These test the system's ability to handle multiple related questions in one query:

```
"What are the automation opportunities mentioned in the requirements documents, and how do they differ from what was proposed to the customer?"
```

```
"Compare the workflow automation opportunities mentioned in meeting minutes versus what was outlined in the proposal for customer P15."
```

```
"What were the key concerns or risks mentioned across all documents for customer P15, and how were they addressed in the proposal?"
```

### 2. **Temporal/Time-Based Queries**
Test understanding of document chronology and time references:

```
"What requirements were mentioned in documents uploaded before January 10th?"
```

```
"What changed between the initial requirements document and the latest proposal for customer P15?"
```

```
"Show me all requirements that were discussed in meetings but not yet addressed in proposals."
```

### 3. **Cross-Document Reasoning**
Requires connecting information across multiple document types:

```
"What questions were asked in the questionnaire that directly relate to requirements mentioned in meeting minutes?"
```

```
"Based on the questionnaire responses, which requirements from the initial documents were confirmed as priorities?"
```

```
"How do the customer's questionnaire responses align with the automation opportunities identified in the requirements documents?"
```

### 4. **Specific Document Type Filtering**
Test precise document type understanding:

```
"What did customer P15 specifically say in their questionnaire response about data requirements?"
```

```
"What automation opportunities were identified in requirements documents but NOT mentioned in proposals?"
```

```
"Compare the questions asked in questionnaires versus the answers provided in questionnaire responses for customer P15."
```

### 5. **Ambiguous/Open-Ended Queries**
Test query understanding and intent detection:

```
"Tell me everything about workflows."
```

```
"What's the deal with automation?"
```

```
"Show me what customers are saying about their needs."
```

### 6. **Aggregation and Summary Queries**
Requires combining information from multiple sources:

```
"What are all the different types of automation mentioned across all customer documents?"
```

```
"List all customers who mentioned AI or machine learning in their requirements or questionnaire responses."
```

```
"What are the most common concerns or risks mentioned across all proposals?"
```

### 7. **Technical/Specific Queries**
Test precision with technical terms:

```
"What specific data sources or APIs were mentioned as required for the AI automation solutions?"
```

```
"What are the technical constraints or limitations mentioned in the requirements documents?"
```

```
"Which documents mention integration with CRM or LMS systems?"
```

### 8. **Comparison Queries**
Requires comparing information across customers or documents:

```
"How do the requirements for customer P15 differ from customer P9?"
```

```
"Compare the automation opportunities identified for different customers."
```

```
"What are the similarities and differences between proposals presented to different customers?"
```

### 9. **Negative/Exclusion Queries**
Test understanding of what's NOT present:

```
"What requirements were mentioned but NOT included in the proposal?"
```

```
"Which automation opportunities were discussed but not yet implemented according to the documents?"
```

```
"What questions were asked in questionnaires but not answered in questionnaire responses?"
```

### 10. **Multi-Customer Queries**
Test filtering and aggregation across customers:

```
"Which customers have requirements related to student support workflows?"
```

```
"Show me all customers who mentioned externship placement in their documents."
```

```
"What are the common themes across all customer requirements documents?"
```

### 11. **Context-Dependent Queries**
Requires understanding context and relationships:

```
"What was the customer's response to questions about their current workflow challenges?"
```

```
"Based on the meeting minutes, what were the customer's main pain points that led to the proposed solutions?"
```

```
"How did the proposal address the specific concerns raised in the questionnaire responses?"
```

### 12. **Quantitative Queries**
Test extraction of numbers, dates, and metrics:

```
"What timelines were mentioned in proposals, and how do they compare?"
```

```
"How many automation opportunities were identified per customer?"
```

```
"What are the specific dates mentioned for project phases across all proposals?"
```

### 13. **Causal/Why Queries**
Test reasoning about cause and effect:

```
"Why were certain automation opportunities prioritized over others in the proposals?"
```

```
"What reasons were given for choosing specific AI solutions?"
```

```
"Why were certain requirements identified as high priority?"
```

### 14. **Hypothetical/What-If Queries**
Test inference capabilities:

```
"If we implemented all the automation opportunities mentioned, what would be the impact?"
```

```
"What would be needed to implement the proposed solutions?"
```

```
"What dependencies exist between different automation opportunities?"
```

### 15. **Edge Cases and Tricky Queries**
Test robustness:

```
"Find documents where the customer name contains 'P' followed by a number."
```

```
"What was discussed in the most recent meeting versus the oldest meeting?"
```

```
"Show me requirements that appear in multiple documents for the same customer."
```

---

## 📊 Testing Checklist

When testing these queries, evaluate:

- ✅ **Accuracy**: Does it return correct information?
- ✅ **Precision**: Are results relevant to the query?
- ✅ **Recall**: Does it find all relevant information?
- ✅ **Document Type Understanding**: Does it distinguish between questionnaire vs questionnaire_response?
- ✅ **Customer Filtering**: Does it correctly filter by customer when specified?
- ✅ **Cross-Document Reasoning**: Can it connect information across documents?
- ✅ **Formatting**: Is the response well-structured and readable?
- ✅ **Source Citations**: Are sources properly cited?
- ✅ **Handling Ambiguity**: How does it handle unclear queries?
- ✅ **Performance**: Response time and token usage

---

## 🎯 Recommended Test Sequence

1. **Start Simple**: Basic customer-specific queries
2. **Add Complexity**: Multi-part questions
3. **Test Filtering**: Document type and customer filtering
4. **Test Reasoning**: Cross-document connections
5. **Test Edge Cases**: Ambiguous and tricky queries
6. **Test Aggregation**: Multi-customer and summary queries

---

## 💡 Tips for Testing

- Test with real customer data (P15, P9, etc.)
- Compare results before and after improvements
- Check if hybrid search improves keyword-heavy queries
- Verify re-ranking improves result ordering
- Test with queries that have low semantic similarity but high keyword match
- Test with queries that require temporal understanding
