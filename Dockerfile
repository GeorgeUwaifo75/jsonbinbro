# Use an official Python 3.11 runtime as the base image
FROM python:3.11-slim-bookworm

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Run the application using uvicorn
# Use environment variable for port, default to 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]