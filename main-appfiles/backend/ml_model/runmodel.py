import joblib
data = joblib.load('tfidf_vectorizer.joblib')
data1 = joblib.load('phishing_model.joblib')
print(data)
print(data1)