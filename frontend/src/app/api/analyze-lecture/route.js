export async function POST(request) {
  try {
    const url = new URL(request.url);
    const ytLink = url.searchParams.get('yt_link');

    const formData = await request.formData();

    let backendUrl = 'http://localhost:8000/analyze-lecture';
    if (ytLink) {
      backendUrl += `?yt_link=${encodeURIComponent(ytLink)}`;
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });

  } catch (error) {
    return Response.json({ detail: error.message }, { status: 500 });
  }
}