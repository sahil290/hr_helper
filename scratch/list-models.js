async function listModels() {
  const apiKey = "AIzaSyCAIW3d-NTKfol8VPMNDw5zumtk7rMZs-s";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

listModels();
