// This is a simple example of how to test the MCP OpenAPI Schema server
// using the official MCP SDK client
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Set up the MCP client to communicate with our server
const transport = new StdioClientTransport({
  command: "node",
  args: [
    resolve(__dirname, "index.mjs"),
    resolve(__dirname, "./sample-petstore.yaml")
  ],
});

const client = new Client({
  name: "openapi-schema-client",
  version: "1.0.0",
});

// Connect to the server
console.log("Connecting to MCP server...");
await client.connect(transport);
console.log("Connected to MCP server successfully!");

// Run example tool calls
try {
  // List endpoints
  console.log("\n--- LISTING ENDPOINTS ---");
  const endpoints = await client.callTool({
    name: "list-endpoints",
    arguments: {},
  });
  console.log(endpoints.content[0].text);

  // Get endpoint details
  console.log("\n--- GET ENDPOINT DETAILS ---");
  const endpointDetails = await client.callTool({
    name: "get-endpoint",
    arguments: {
      path: "/pets",
      method: "get",
    },
  });
  console.log(endpointDetails.content[0].text);

  // Get request body schema
  console.log("\n--- GET REQUEST BODY SCHEMA ---");
  const requestBody = await client.callTool({
    name: "get-request-body",
    arguments: {
      path: "/pets",
      method: "post",
    },
  });
  console.log(requestBody.content[0].text);

  // List components
  console.log("\n--- LIST COMPONENTS ---");
  const components = await client.callTool({
    name: "list-components",
    arguments: {},
  });
  console.log(components.content[0].text);

  // Get component schema
  console.log("\n--- GET COMPONENT SCHEMA ---");
  const component = await client.callTool({
    name: "get-component",
    arguments: {
      type: "schemas",
      name: "Pet",
    },
  });
  console.log(component.content[0].text);

  // Search schema
  console.log("\n--- SEARCH SCHEMA ---");
  const searchResults = await client.callTool({
    name: "search-schema",
    arguments: {
      pattern: "pet",
    },
  });
  console.log(searchResults.content[0].text);

  // Get path parameters
  console.log("\n--- GET PATH PARAMETERS ---");
  const parameters = await client.callTool({
    name: "get-path-parameters",
    arguments: {
      path: "/pets/{petId}",
      method: "get",
    },
  });
  console.log(parameters.content[0].text);

  // Get response schema
  console.log("\n--- GET RESPONSE SCHEMA ---");
  const response = await client.callTool({
    name: "get-response-schema",
    arguments: {
      path: "/pets/{petId}",
      method: "get",
      statusCode: "200",
    },
  });
  console.log(response.content[0].text);

  // List security schemes
  console.log("\n--- LIST SECURITY SCHEMES ---");
  const security = await client.callTool({
    name: "list-security-schemes",
    arguments: {},
  });
  console.log(security.content[0].text);
} catch (error) {
  console.error("Error during testing:", error);
} finally {
  // Close the connection
  await client.close();
  console.log("\nTests completed, disconnected from server.");
}
